import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-this-in-prod'
);

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session');

    if (!token) {
        return NextResponse.json({ user: null });
    }

    try {
        const { payload } = await jwtVerify(token.value, SECRET_KEY);
        return NextResponse.json({ user: payload });
    } catch (error) {
        return NextResponse.json({ user: null });
    }
}
