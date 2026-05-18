/**
 * Renderiza texto con markdown inline básico:
 *  - **negritas**
 *  - *itálicas*
 *  - `código`
 *
 * Liviano: sin dependencias externas, solo para los mensajes del chat.
 */

import React from 'react';

interface InlineMarkdownProps {
    text: string;
    className?: string;
}

function renderSegment(segment: string, key: number): React.ReactNode {
    const boldMatch = segment.match(/^\*\*(.+?)\*\*$/);
    if (boldMatch) {
        return <strong key={key} className="font-bold text-slate-900">{boldMatch[1]}</strong>;
    }

    const italicMatch = segment.match(/^\*(.+?)\*$/);
    if (italicMatch) {
        return <em key={key} className="italic">{italicMatch[1]}</em>;
    }

    const codeMatch = segment.match(/^`(.+?)`$/);
    if (codeMatch) {
        return (
            <code key={key} className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-[0.9em] font-mono">
                {codeMatch[1]}
            </code>
        );
    }

    return <React.Fragment key={key}>{segment}</React.Fragment>;
}

export function InlineMarkdown({ text, className }: InlineMarkdownProps) {
    if (!text) return null;

    const paragraphs = text.split(/\n\s*\n/);

    return (
        <div className={className}>
            {paragraphs.map((para, pIdx) => {
                const lines = para.split('\n');

                const lineNodes = lines.map((line, lIdx) => {
                    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);
                    const segments = parts.map((p, i) => renderSegment(p, i));
                    return (
                        <React.Fragment key={lIdx}>
                            {segments}
                            {lIdx < lines.length - 1 && <br />}
                        </React.Fragment>
                    );
                });

                return (
                    <p key={pIdx} className={pIdx > 0 ? 'mt-3' : ''}>
                        {lineNodes}
                    </p>
                );
            })}
        </div>
    );
}
