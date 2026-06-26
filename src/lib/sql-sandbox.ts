/**
 * SQL Sandbox - Read-Only Validator
 *
 * Primera linea de defensa contra modificaciones a la base de datos.
 * Idealmente complementado por un usuario de SQL con permisos `db_datareader` unicamente.
 *
 * Rechaza:
 * - DML de escritura: INSERT, UPDATE, DELETE, MERGE, TRUNCATE
 * - DDL: CREATE, ALTER, DROP, RENAME
 * - DCL: GRANT, REVOKE, DENY
 * - Procedural: EXEC, EXECUTE, sp_*, xp_*
 * - Transaccional peligroso: COMMIT/ROLLBACK aislados, SHUTDOWN
 * - Concatenacion peligrosa: multiples statements separados por ;
 */

const FORBIDDEN_KEYWORDS = [
    'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE',
    'CREATE', 'ALTER', 'DROP', 'RENAME',
    'GRANT', 'REVOKE', 'DENY',
    'EXEC', 'EXECUTE',
    'SHUTDOWN', 'BACKUP', 'RESTORE',
    'BULK', 'OPENROWSET', 'OPENDATASOURCE',
    'WAITFOR'
];

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
    { pattern: /\bsp_\w+/i, reason: 'Stored procedures del sistema no permitidos' },
    { pattern: /\bxp_\w+/i, reason: 'Extended procedures no permitidos' },
    { pattern: /;\s*\w+/i, reason: 'Multiples statements en una consulta no permitidos' }
];

export interface SqlValidationResult {
    valid: boolean;
    reason?: string;
    sanitized?: string;
}

export function validateReadOnlySql(sql: string): SqlValidationResult {
    if (!sql || typeof sql !== 'string') {
        return { valid: false, reason: 'SQL vacio o invalido' };
    }

    const trimmed = sql.trim();
    if (trimmed.length === 0) {
        return { valid: false, reason: 'SQL vacio' };
    }

    // Remueve strings y comentarios PRIMERO, para no falsear positivos sobre
    // literales ni sobre comentarios. Hacerlo antes del check de inicio evita
    // bloquear SELECTs legítimos que vienen precedidos de un comentario
    // explicativo (común en algunos modelos como Sonnet).
    const stripped = trimmed
        .replace(/'(?:[^']|'')*'/g, "''")
        .replace(/"(?:[^"]|"")*"/g, '""')
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

    // Normaliza: ignora `;` y espacios iniciales. `;WITH ...` es un idiom
    // válido de T-SQL para terminar un statement previo y no debe bloquearse.
    const normalized = stripped.replace(/^[\s;]+/, '').trim();

    // Permite solo statements que arranquen con SELECT o WITH (CTE)
    const startsWithReadOp = /^(WITH\b|SELECT\b|\(\s*SELECT\b)/i.test(normalized);
    if (!startsWithReadOp) {
        return {
            valid: false,
            reason: 'Solo se permiten consultas de lectura (SELECT o WITH)'
        };
    }

    // Tokenize palabras
    const upper = normalized.toUpperCase();
    for (const kw of FORBIDDEN_KEYWORDS) {
        const re = new RegExp(`\\b${kw}\\b`, 'i');
        if (re.test(upper)) {
            return {
                valid: false,
                reason: `Operacion prohibida: ${kw}. Este agente solo puede consultar datos, no modificarlos.`
            };
        }
    }

    // Patrones peligrosos (sobre el SQL ya normalizado, sin `;` inicial)
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        if (pattern.test(normalized)) {
            return { valid: false, reason };
        }
    }

    // Sanitiza: remueve `;` final innecesario
    const sanitized = trimmed.replace(/;\s*$/, '');

    return { valid: true, sanitized };
}

/**
 * Wrapper de seguridad para envolver la ejecucion de queries.
 * Lanza error si la consulta no es de solo lectura.
 */
export function assertReadOnly(sql: string): string {
    const result = validateReadOnlySql(sql);
    if (!result.valid) {
        throw new Error(`SQL bloqueado por sandbox: ${result.reason}`);
    }
    return result.sanitized!;
}
