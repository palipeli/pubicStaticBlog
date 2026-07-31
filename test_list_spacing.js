// Test to check if blank lines between list items break the list
const fs = require('fs');

// Load markdown.js 
const mdjsContent = fs.readFileSync('/workspace/js/markdown.js', 'utf8');

// Create a minimal test environment with window object
const vm = require('vm');
const sandbox = {
    console: console,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
    window: {}
};

vm.createContext(sandbox);
vm.runInContext(mdjsContent, sandbox);

// Get the parseMarkdown function from window
const parseMarkdown = sandbox.window.parseMarkdown;

// Test 1: List with blank lines between items (like in the markdown file)
const testMd1 = `1. First item

2. Second item

3. Third item

4. Fourth item`;

console.log("Test 1: List with blank lines between items");
console.log("---");
const result1 = parseMarkdown(testMd1);
console.log(result1);
console.log("");

// Count <ol> tags
const olCount1 = (result1.match(/<ol>/g) || []).length;
const liCount1 = (result1.match(/<li>/g) || []).length;
console.log(`Result: ${olCount1} <ol> tags, ${liCount1} <li> tags`);
if (olCount1 > 1) {
    console.log("⚠ ISSUE: Multiple <ol> tags found - blank lines are breaking the list into separate lists!");
}
console.log("\n---\n");

// Test 2: List without blank lines
const testMd2 = `1. First item
2. Second item
3. Third item
4. Fourth item`;

console.log("Test 2: List without blank lines between items");
console.log("---");
const result2 = parseMarkdown(testMd2);
console.log(result2);
console.log("");

const olCount2 = (result2.match(/<ol>/g) || []).length;
const liCount2 = (result2.match(/<li>/g) || []).length;
console.log(`Result: ${olCount2} <ol> tags, ${liCount2} <li> tags`);
if (olCount2 === 1 && liCount2 === 4) {
    console.log("✓ CORRECT: Single <ol> with 4 items");
}
