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
    { pattern: /;\s*\w+/i, reason: 'Multiples statements en una consulta no permitidos' },
    { pattern: /--[^\n]*\b(insert|update|delete|drop)\b/i, reason: 'Comentarios con keywords prohibidas detectados' },
    { pattern: /\/\*[\s\S]*?\b(insert|update|delete|drop)\b[\s\S]*?\*\//i, reason: 'Comentarios con keywords prohibidas detectados' }
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

    // Permite solo statements que arranquen con SELECT o WITH (CTE)
    const startsWithReadOp = /^(\s*WITH\b|\s*SELECT\b|\s*\(\s*SELECT\b)/i.test(trimmed);
    if (!startsWithReadOp) {
        return {
            valid: false,
            reason: 'Solo se permiten consultas de lectura (SELECT o WITH)'
        };
    }

    // Remueve strings y comentarios para no falsear positivos sobre literales
    const stripped = trimmed
        .replace(/'(?:[^']|'')*'/g, "''")
        .replace(/"(?:[^"]|"")*"/g, '""')
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');

    // Tokenize palabras
    const upper = stripped.toUpperCase();
    for (const kw of FORBIDDEN_KEYWORDS) {
        const re = new RegExp(`\\b${kw}\\b`, 'i');
        if (re.test(upper)) {
            return {
                valid: false,
                reason: `Operacion prohibida: ${kw}. Este agente solo puede consultar datos, no modificarlos.`
            };
        }
    }

    // Patrones peligrosos
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        if (pattern.test(stripped)) {
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
