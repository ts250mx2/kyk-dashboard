import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = process.env.JWT_SECRET;
const SECRET_KEY = new TextEncoder().encode(secret || 'dev-secret-key-replaces-this-in-prod');

// CORS para el preview web de la app móvil (Expo en modo web). Se permiten
// solo orígenes locales o de red privada (RFC1918) — un sitio público nunca
// puede presentar estos orígenes; las apps nativas no usan CORS.
function isAllowedCorsOrigin(origin: string): boolean {
    try {
        const url = new URL(origin);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
        const host = url.hostname;
        if (host === 'localhost' || host === '127.0.0.1') return true;
        return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    } catch {
        return false;
    }
}

function withCors(response: NextResponse, origin: string) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
    return response;
}

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('session');
    const { pathname } = request.nextUrl;

    // CORS para el preview web de la app móvil: responder el preflight y
    // marcar el origen permitido en las respuestas de /api.
    const origin = request.headers.get('origin') || '';
    const corsAllowed = pathname.startsWith('/api') && !!origin && isAllowedCorsOrigin(origin);
    if (corsAllowed && request.method === 'OPTIONS') {
        return withCors(new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400',
            },
        }), origin);
    }

    // 1. Si está activa la variable ONLY_WHATSAPP, bloqueamos todo excepto las APIs de
    //    WhatsApp y los enlaces públicos compartibles (página /r/<uuid> + su API /api/share).
    if (process.env.ONLY_WHATSAPP === 'true') {
        const isPublicShare = pathname.startsWith('/api/whatsapp')
            || pathname.startsWith('/api/share')
            || pathname.startsWith('/r/');
        if (!isPublicShare) {
            console.log(`🔒 ONLY_WHATSAPP activo: Bloqueando acceso a ${pathname}`);
            return new NextResponse(
                JSON.stringify({ error: 'Acceso denegado. Este puerto solo atiende servicios de WhatsApp.' }),
                { status: 403, headers: { 'content-type': 'application/json' } }
            );
        }
    }

    // Debug: Log all cookie names
    const allCookies = request.cookies.getAll().map(c => c.name).join(', ');
    console.log(`🔍 Middleware [${pathname}]: Session set: ${!!session}. All cookies: [${allCookies}]`);

    // 2. Permitir acceso a la página de login, a las APIs y a los enlaces públicos
    //    compartibles (/r/<uuid>) en modo normal sin protección de sesión general
    if (pathname === '/login' || pathname.startsWith('/api') || pathname.startsWith('/r/')) {
        // Si el usuario ya tiene sesión activa e intenta ir a login, redirigir a dashboard
        if (session && pathname === '/login') {
            try {
                await jwtVerify(session.value, SECRET_KEY);
                return NextResponse.redirect(new URL('/dashboard', request.url));
            } catch (e) {
                // Token inválido, dejarlo en login
            }
        }
        const response = NextResponse.next();
        return corsAllowed ? withCors(response, origin) : response;
    }

    // 3. Proteger la ruta raíz y cualquier otra página no excluida arriba
    if (!session) {
        console.log(`⚠️ Middleware: Redirigiendo a /login (Sesión no encontrada) para ${pathname}`);
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        await jwtVerify(session.value, SECRET_KEY);
        return NextResponse.next();
    } catch (error) {
        // Token inválido
        console.log(`❌ Middleware: Redirigiendo a /login (Token inválido o expirado) para ${pathname}`);
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

export const config = {
    matcher: [
        /*
         * Intercepta todas las peticiones excepto los archivos estáticos e imágenes.
         * Esto nos permite filtrar APIs en caso de que ONLY_WHATSAPP esté activo.
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
