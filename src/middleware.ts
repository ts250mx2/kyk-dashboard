import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = process.env.JWT_SECRET;
const SECRET_KEY = new TextEncoder().encode(secret || 'dev-secret-key-replaces-this-in-prod');

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('session');
    const { pathname } = request.nextUrl;

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
        return NextResponse.next();
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
