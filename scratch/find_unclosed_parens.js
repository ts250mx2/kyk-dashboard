const fs = require('fs');
const content = fs.readFileSync('c:/Users/Ruben/Documents/Antigravity Projects/kyk-dashboard/src/components/purchases/PurchaseKanbanModal.tsx', 'utf8');

const lines = content.split('\n');
const stack = [];

lines.forEach((line, i) => {
    const openMatches = line.match(/\(/g);
    const closeMatches = line.match(/\)/g);

    if (openMatches) {
        openMatches.forEach(() => stack.push(i + 1));
    }
    if (closeMatches) {
        closeMatches.forEach(() => stack.pop());
    }
});

console.log('Unclosed paren start lines:', stack);
