/**
 * Tests del SQL Sandbox (sin framework de testing).
 *
 * Ejecutar con:
 *   npx tsx scripts/test-sql-sandbox.ts
 *
 * Es un test crítico de seguridad. Si una de estas assertions falla,
 * el sandbox tiene un hueco y NO se debe deployar a producción.
 */

import { validateReadOnlySql, assertReadOnly } from '../src/lib/sql-sandbox';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${name}`);
    } else {
        failed++;
        const msg = detail ? `${name} — ${detail}` : name;
        failures.push(msg);
        console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function shouldAllow(sql: string, label: string) {
    const r = validateReadOnlySql(sql);
    assert(r.valid === true, `ALLOW: ${label}`, r.valid ? undefined : r.reason);
}

function shouldBlock(sql: string, label: string) {
    const r = validateReadOnlySql(sql);
    assert(r.valid === false, `BLOCK: ${label}`, r.valid ? 'No fue bloqueado' : undefined);
}

console.log('\n=== SQL Sandbox Tests ===\n');

console.log('--- Casos permitidos (deben pasar) ---');
shouldAllow('SELECT * FROM Ventas', 'SELECT simple');
shouldAllow('  SELECT * FROM Ventas  ', 'SELECT con whitespace');
shouldAllow('select id from ventas', 'SELECT lowercase');
shouldAllow('SELECT TOP 10 * FROM Ventas WHERE [Año] = 2026', 'SELECT con corchetes y filtro');
shouldAllow('WITH cte AS (SELECT 1 AS x) SELECT * FROM cte', 'WITH (CTE)');
shouldAllow('(SELECT 1)', 'SELECT entre paréntesis');
shouldAllow("SELECT 'INSERT' AS palabra FROM Ventas", 'String literal con palabra prohibida (INSERT en comilla)');
shouldAllow("SELECT 'DELETE FROM tabla' AS comentario", 'String literal con DELETE');
shouldAllow('SELECT 1; ', 'SELECT con punto y coma al final (sanitiza)');
shouldAllow('SELECT Folio FROM Cancelaciones WHERE Total > 1000 ORDER BY [Fecha Cancelacion] DESC', 'Real-world query');

console.log('\n--- Casos bloqueados (deben fallar) ---');
shouldBlock('INSERT INTO Ventas VALUES (1)', 'INSERT directo');
shouldBlock('UPDATE Ventas SET Total = 0', 'UPDATE');
shouldBlock('DELETE FROM Ventas', 'DELETE');
shouldBlock('DROP TABLE Ventas', 'DROP');
shouldBlock('ALTER TABLE Ventas ADD col INT', 'ALTER');
shouldBlock('TRUNCATE TABLE Ventas', 'TRUNCATE');
shouldBlock('CREATE TABLE foo (id INT)', 'CREATE');
shouldBlock('MERGE INTO Ventas USING tbl ON 1=1', 'MERGE');
shouldBlock('GRANT SELECT ON Ventas TO public', 'GRANT');
shouldBlock('REVOKE SELECT ON Ventas FROM public', 'REVOKE');
shouldBlock('EXEC sp_executesql', 'EXEC');
shouldBlock('EXECUTE sp_executesql', 'EXECUTE');
shouldBlock('SELECT * FROM Ventas; DROP TABLE Ventas', 'Multi-statement con DROP');
shouldBlock('SELECT * FROM Ventas; INSERT INTO X VALUES (1)', 'Multi-statement con INSERT');
// Comentarios SQL son inertes (no se ejecutan), por eso se permiten — esto es comportamiento correcto.
shouldAllow('SELECT * FROM Ventas /* INSERT INTO X */', 'Comentario bloque con palabra prohibida (inerte)');
shouldAllow('SELECT * FROM Ventas -- DROP TABLE Ventas', 'Comentario línea con palabra prohibida (inerte)');
shouldBlock('EXEC xp_cmdshell', 'xp_cmdshell');
shouldBlock('SELECT sp_help', 'sp_*');
shouldBlock('WAITFOR DELAY \'00:00:10\'', 'WAITFOR');
shouldBlock('BACKUP DATABASE x TO disk', 'BACKUP');
shouldBlock('BULK INSERT Ventas FROM file', 'BULK INSERT');
shouldBlock('SELECT * FROM OPENROWSET(...)', 'OPENROWSET');

console.log('\n--- Edge cases ---');
shouldBlock('', 'String vacío');
shouldBlock('   ', 'Solo whitespace');
// @ts-expect-error -- testing runtime behavior con tipo malo a propósito
shouldBlock(null, 'null');
// @ts-expect-error -- testing runtime behavior con tipo malo a propósito
shouldBlock(undefined, 'undefined');
shouldBlock('UPDATE Ventas SET Total = 0 -- SELECT comment', 'UPDATE con comentario SELECT al final');
shouldAllow(`SELECT * FROM Ventas WHERE Tienda = 'I''m here'`, 'Apóstrofes escapadas');

console.log('\n--- assertReadOnly (throw si es inválido) ---');
try {
    assertReadOnly('SELECT 1');
    assert(true, 'assertReadOnly permite SELECT válido');
} catch {
    assert(false, 'assertReadOnly permite SELECT válido', 'lanzó error');
}

try {
    assertReadOnly('DROP TABLE x');
    assert(false, 'assertReadOnly bloquea DROP', 'no lanzó error');
} catch {
    assert(true, 'assertReadOnly bloquea DROP');
}

console.log('\n=== Resumen ===');
console.log(`${passed} passed · ${failed} failed`);

if (failed > 0) {
    console.log('\n❌ TESTS FALLARON:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
} else {
    console.log('\n✓ Todos los tests pasaron');
    process.exit(0);
}
