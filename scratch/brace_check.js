const fs = require('fs');
const content = fs.readFileSync('c:/Users/Ruben/Documents/Antigravity Projects/kyk-dashboard/src/components/purchases/PurchaseKanbanModal.tsx', 'utf8');

const stack = [];
let i = 0;
while (i < content.length) {
    if (content[i] === '{' && content[i+1] !== '/') {
        stack.push(i);
    } else if (content[i] === '}') {
        stack.pop();
    }
    i++;
}

console.log('Unclosed braces at indices:', stack);
stack.forEach(idx => {
    const line = content.slice(0, idx).split('\n').length;
    console.log(`Line ${line}: ${content.slice(idx, idx + 20)}`);
});
