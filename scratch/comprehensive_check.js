const fs = require('fs');
const content = fs.readFileSync('c:/Users/Ruben/Documents/Antigravity Projects/kyk-dashboard/src/components/purchases/PurchaseKanbanModal.tsx', 'utf8');

const TAGS = ['div', 'span', 'tr', 'td', 'table', 'tbody', 'thead', 'tfoot', 'button', 'h2', 'p', 'KanbanItem', 'ExternalLink', 'FileSpreadsheet', 'ArrowLeftRight', 'Minimize2', 'Maximize2', 'X', 'Search', 'RotateCcw', 'ArrowUpRight', 'Clock', 'Receipt', 'Filter', 'AlertTriangle', 'Check', 'InvoiceConceptsModal', 'ReceiptDetailModal'];

TAGS.forEach(tag => {
    const openRegex = new RegExp(`<${tag}(\\s|>|\\/)`, 'g');
    const closeRegex = new RegExp(`</${tag}>`, 'g');
    
    let openCount = 0;
    let match;
    while ((match = openRegex.exec(content)) !== null) {
        // Check if it is self-closing
        const startIdx = match.index;
        const endOfTag = content.indexOf('>', startIdx);
        const tagContent = content.slice(startIdx, endOfTag + 1);
        if (!tagContent.endsWith('/>')) {
            openCount++;
        }
    }
    
    let closeCount = 0;
    while ((match = closeRegex.exec(content)) !== null) {
        closeCount++;
    }
    
    if (openCount !== closeCount) {
        console.log(`Mismatch in tag <${tag}>: Open ${openCount}, Close ${closeCount}`);
    }
});
