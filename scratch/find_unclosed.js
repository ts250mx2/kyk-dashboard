const fs = require('fs');
const content = fs.readFileSync('c:/Users/Ruben/Documents/Antigravity Projects/kyk-dashboard/src/components/purchases/PurchaseKanbanModal.tsx', 'utf8');

const lines = content.split('\n');
const stack = [];

lines.forEach((line, i) => {
    // This is a naive regex-based parser, it won't be perfect but it might help find the obvious ones.
    const openMatches = line.match(/<div(\s|>)/g);
    const closeMatches = line.match(/<\/div>/g);

    if (openMatches) {
        openMatches.forEach(() => stack.push(i + 1));
    }
    if (closeMatches) {
        closeMatches.forEach(() => stack.pop());
    }
});

console.log('Unclosed div start lines:', stack);
