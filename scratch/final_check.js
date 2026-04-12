const fs = require('fs');
const content = fs.readFileSync('c:/Users/Ruben/Documents/Antigravity Projects/kyk-dashboard/src/components/purchases/PurchaseKanbanModal.tsx', 'utf8');

const lines = content.split('\n');
const stack = [];

lines.forEach((line, i) => {
    // Avoid self-closing tags and comments
    if (line.trim().startsWith('{/*')) return;
    
    const openMatches = line.match(/<div(?!\s+[^>]*?\/>)(?:\s|>)/g);
    const closeMatches = line.match(/<\/div>/g);

    if (openMatches) {
        openMatches.forEach(() => stack.push(i + 1));
    }
    if (closeMatches) {
        closeMatches.forEach(() => stack.pop());
    }
});

console.log('Open stack at end (line numbers):', stack);
console.log('Total unclosed:', stack.length);
