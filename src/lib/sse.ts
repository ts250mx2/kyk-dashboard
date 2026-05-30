/**
 * Server-Sent Events helpers para streaming desde Next.js route handlers.
 *
 * Formato wire (cada evento termina en doble newline):
 *   event: text-delta
 *   data: {"text":"Las "}
 *
 *   event: metadata
 *   data: {"key_insights":[...]}
 *
 *   event: done
 *   data: {}
 */

export type SseEventName =
    | 'text-delta'       // chunk de texto del summary
    | 'status'           // estado del pipeline (consultando datos, analizando, etc)
    | 'metadata'         // payload con insights, recommendations, reports, data, etc
    | 'clarification'    // el agente pidió aclaración (no es analítico)
    | 'error'            // error recuperable o terminal
    | 'done'             // fin de stream
    // --- Agente Avanzado (consola): logs en vivo del loop multi-turno ---
    | 'tool-call'        // el modelo invocó una tool { name, input }
    | 'tool-result'      // resultado de la tool { name, ok, rowCount, preview }
    | 'sql'              // SQL ejecutado { sql }
    | 'reasoning'        // texto de razonamiento del assistant entre tools { text }
    | 'usage'            // consumo de tokens/costo acumulado por turno
    | 'report-proposed'  // el agente propone un reporte listo para armar { definition }
    | 'report-saved';    // reporte persistido { idReporte, url }

export interface SseEvent {
    event: SseEventName;
    data: unknown;
}

const encoder = new TextEncoder();

export function formatSse(event: SseEvent): Uint8Array {
    const dataLine = `data: ${JSON.stringify(event.data ?? {})}`;
    const block = `event: ${event.event}\n${dataLine}\n\n`;
    return encoder.encode(block);
}

/**
 * Crea un controlador de stream con utilidades para emitir eventos tipados.
 * El handler recibe el emisor y debe llamar a `close()` al terminar.
 */
export function createSseStream(
    handler: (emit: (event: SseEvent) => void, close: () => void) => Promise<void>
): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            let closed = false;

            const emit = (event: SseEvent) => {
                if (closed) return;
                try {
                    controller.enqueue(formatSse(event));
                } catch {
                    // controlador ya cerrado (cliente desconectó)
                    closed = true;
                }
            };

            const close = () => {
                if (closed) return;
                closed = true;
                try {
                    controller.close();
                } catch { }
            };

            try {
                await handler(emit, close);
            } catch (err: any) {
                emit({ event: 'error', data: { message: err?.message || 'Error en stream' } });
            } finally {
                close();
            }
        }
    });
}

export const SSE_HEADERS = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'  // desactivar buffering en proxies (nginx)
};
