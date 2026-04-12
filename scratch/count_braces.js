const fs = require('fs');
const content = fs.readFileSync('c:/Users/Ruben/Documents/Antigravity Projects/kyk-dashboard/src/components/purchases/PurchaseKanbanModal.tsx', 'utf8');

const openBraces = (content.match(/\{/g) || []).length;
const closeBraces = (content.match(/\}/g) || []).length;
const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;

console.log(`Open Braces: ${openBraces}, Close Braces: ${closeBraces}`);
console.log(`Open Parens: ${openParens}, Close Parens: ${closeParens}`);
