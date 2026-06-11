const http = require('http');

const PORT = process.env.PORT || 8093;
const TARGET_PORT = process.env.TARGET_PORT || 3001;

const server = http.createServer((req, res) => {
    // Permitimos las APIs de WhatsApp y los enlaces públicos compartibles
    // (página /r/<uuid> + su API /api/share/<uuid>), que son de solo lectura por UUID.
    // También /_next/ y favicon para que la página pública cargue sus assets y se hidrate.
    const allowed = req.url.startsWith('/api/whatsapp')
        || req.url.startsWith('/api/share')
        || req.url.startsWith('/r/')
        || req.url.startsWith('/_next/')
        || req.url.startsWith('/favicon');
    if (allowed) {
        console.log(`[Proxy] Reenviando ${req.method} ${req.url} al puerto ${TARGET_PORT}...`);
        
        const options = {
            hostname: 'localhost',
            port: TARGET_PORT,
            path: req.url,
            method: req.method,
            headers: req.headers
        };

        const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });

        req.pipe(proxyReq, { end: true });

        proxyReq.on('error', (err) => {
            console.error(`[Proxy] Error de conexión con el servidor principal en el puerto ${TARGET_PORT}:`, err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: `El servidor principal en el puerto ${TARGET_PORT} no está respondiendo. Asegúrate de que el servidor principal esté activo.` 
            }));
        });
    } else {
        // Bloquear cualquier otra ruta (dashboard, otras APIs, etc.)
        console.log(`[Proxy] Bloqueado acceso a ruta no autorizada: ${req.url}`);
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            error: 'Acceso denegado. Este puerto solo atiende servicios de WhatsApp.' 
        }));
    }
});

server.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`   🔌 PROXY DE WHATSAPP ACTIVO (PRODUCCIÓN / DEV)`);
    console.log(`   Escuchando en: http://localhost:${PORT}`);
    console.log(`   Redirigiendo a: http://localhost:${TARGET_PORT}`);
    console.log(`=================================================\n`);
});
