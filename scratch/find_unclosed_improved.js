const fs = require('fs');
const content = fs.readFileSync('c:/Users/Ruben/Documents/Antigravity Projects/kyk-dashboard/src/components/purchases/PurchaseKanbanModal.tsx', 'utf8');

const lines = content.split('\n');
const stack = [];

lines.forEach((line, i) => {
    // Match normal <div ...> but NOT self-closing <div ... />
    const openMatches = line.match(/<div(?:\s[^>]*?(?!\/)|\s*)>/g);
    const closeMatches = line.match(/<\/div>/g);

    if (openMatches) {
        openMatches.forEach(() => stack.push(i + 1));
    }
    if (closeMatches) {
        closeMatches.forEach(() => stack.pop());
    }
});

console.log('Unclosed non-self-closing div start lines:', stack);
