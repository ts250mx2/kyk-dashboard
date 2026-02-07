import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-this-in-prod'
);

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('session');
    const { pathname } = request.nextUrl;

    // Allow access to login page and API routes (except maybe protected ones, but for now open)
    // We specifically want to protect the root page '/'
    if (pathname === '/login' || pathname.startsWith('/api/auth')) {
        // If user is already logged in and tries to go to login, redirect to home
        if (session && pathname === '/login') {
            try {
                await jwtVerify(session.value, SECRET_KEY);
                return NextResponse.redirect(new URL('/dashboard', request.url));
            } catch (e) {
                // Invalid token, let them stay on login
            }
        }
        return NextResponse.next();
    }

    // Protect the root route and any other routes not excluded above
    if (!session) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        await jwtVerify(session.value, SECRET_KEY);
        return NextResponse.next();
    } catch (error) {
        // Token invalid
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes) -> Wait, we want to protect some API routes? 
         *   Actually, let's just protect the main page and let API routes handle their own auth if needed, 
         *   or protect everything except specific public paths.
         *   For this task, "despues del login abra el chat" implies chat is protected.
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
