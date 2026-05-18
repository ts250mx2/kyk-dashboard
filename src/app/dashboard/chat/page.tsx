"use client";

import { ChatAgent } from '@/components/chat-agent';

/**
 * Página de Asistente Digital a pantalla completa.
 * Reutiliza el mismo componente ChatAgent que el widget flotante,
 * pero en modo "embedded" para que ocupe todo el contenedor sin overlay.
 */
export default function DashboardChatPage() {
    return (
        <div className="h-full w-full">
            <ChatAgent mode="embedded" />
        </div>
    );
}
