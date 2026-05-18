/**
 * Rate limiter en memoria (sin Redis).
 *
 * Diseño: sliding window por usuario+endpoint. Token bucket simple.
 * Adecuado para una app interna o single-instance. Para multi-instance
 * habría que migrar a Redis, pero ese cambio es transparente al call site.
 *
 * Uso:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });
 *   const result = limiter.check(`query:${userId}`);
 *   if (!result.allowed) return 429;
 */

interface Bucket {
    /** Timestamps de cada hit dentro del window (ordenados) */
    hits: number[];
}

export interface RateLimitConfig {
    /** Tamaño del window en milisegundos */
    windowMs: number;
    /** Máximo de requests permitidos en el window */
    max: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    /** Cuántos ms hasta que se libere capacidad (si allowed=false) */
    retryAfterMs: number;
    /** Total de hits actuales en el window */
    current: number;
}

export interface RateLimiter {
    check(key: string): RateLimitResult;
    reset(key: string): void;
    stats(): { totalKeys: number };
}

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
    const buckets = new Map<string, Bucket>();
    const { windowMs, max } = config;

    // Cleanup periódico de buckets viejos para evitar memory leak
    // Solo creamos el timer si estamos en runtime (no en build)
    if (typeof setInterval !== 'undefined') {
        setInterval(() => {
            const cutoff = Date.now() - windowMs * 2;
            for (const [key, b] of buckets.entries()) {
                if (b.hits.length === 0 || b.hits[b.hits.length - 1] < cutoff) {
                    buckets.delete(key);
                }
            }
        }, windowMs);
    }

    return {
        check(key: string): RateLimitResult {
            const now = Date.now();
            const cutoff = now - windowMs;
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = { hits: [] };
                buckets.set(key, bucket);
            }
            // Purga hits viejos del bucket
            bucket.hits = bucket.hits.filter(t => t > cutoff);

            if (bucket.hits.length >= max) {
                const oldest = bucket.hits[0];
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfterMs: Math.max(0, oldest + windowMs - now),
                    current: bucket.hits.length
                };
            }

            bucket.hits.push(now);
            return {
                allowed: true,
                remaining: max - bucket.hits.length,
                retryAfterMs: 0,
                current: bucket.hits.length
            };
        },
        reset(key: string) {
            buckets.delete(key);
        },
        stats() {
            return { totalKeys: buckets.size };
        }
    };
}

// Limiters compartidos para endpoints específicos
export const queryLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });    // 30 req/min
export const alertCreateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 }); // 10 req/min
export const cronLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });      // 5 evaluations/min
