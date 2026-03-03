import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

const getSecretKey = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
        console.warn('⚠️ WARNING: JWT_SECRET environment variable is missing in production!');
    }
    return new TextEncoder().encode(secret || 'dev-secret-key-replaces-this-in-prod');
};

const SECRET_KEY = getSecretKey();

export async function POST(request: Request) {
    try {
        const { codigobarras, password } = await request.json();

        if (!codigobarras || !password) {
            return NextResponse.json(
                { error: 'Código de barras y contraseña son requeridos' },
                { status: 400 }
            );
        }

        // Query the database to find the user
        // Assuming 'Nombre' is the column for the user's name. Adjust if different.
        const users = await query(
            `SELECT * FROM tblUsuarios WHERE Status = 0 AND CodigoBarras = @p0 AND Contrasenia2 = @p1`,
            [codigobarras, password]
        );

        const user = users[0];

        if (!user) {
            return NextResponse.json(
                { error: 'Credenciales inválidas' },
                { status: 401 }
            );
        }

        // Create JWT
        const token = await new SignJWT({
            id: user.IdUsuario || user.id || 'unknown', // Fallback if IdUsuario doesn't exist
            name: user.Usuario,
            codigobarras: user.codigobarras
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(SECRET_KEY);

        // Set cookie
        const cookieStore = await cookies();
        cookieStore.set('session', token, {
            httpOnly: true,
            secure: false, // Set to false to support HTTP production environments (like nexusmty.ddns.net if not SSL)
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 24 hours
            path: '/',
        });

        // Log successful access
        console.log(`✅ Acceso correcto: Usuario "${user.Usuario}" (${user.CodigoBarras}) ha iniciado sesión.`);

        return NextResponse.json({
            success: true,
            user: {
                name: user.Usuario,
                codigobarras: user.codigobarras
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
