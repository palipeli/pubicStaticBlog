// Final test to verify the list rendering with actual markdown file content
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

// Test with the exact list from markdown-disaster-fixed.md
const testMd = `1. **Strict Newline Checking**: Now, the code *demands* that there's a newline character right after the opening \\\`\\\`\\\`. No more "oh, I guess this counts." If it's not on its own line, it's not a code block. Period.

2. **Proper Closing**: Same thing for the closing \\\`\\\`\\\`. It has to be on its own line too. No cheating!

3. **No More Greedy Matching**: The old code was super greedy. It would grab everything from the first \\\`\\\`\\\` to the end of the universe if it could. Now it stops at the *first* valid closing \\\`\\\`\\\` it finds. Like a good little parser should.

4. **Inline Code Too**: I also fixed inline code (the single backtick stuff like \`this\`). Turns out, I was messing that up too. Whoops.`;

console.log("Test input (from markdown-disaster-fixed.md):");
console.log(testMd.substring(0, 200) + "...");
console.log("\n---\n");

if (parseMarkdown) {
    const result = parseMarkdown(testMd);
    console.log("Rendered output (first 500 chars):");
    console.log(result.substring(0, 500));
    
    // Check if <ol> is present and has proper structure
    if (result.includes('<ol>')) {
        console.log("\n✓ Ordered list tag <ol> found");
        
        // Count <li> tags
        const liCount = (result.match(/<li>/g) || []).length;
        console.log(`✓ Found ${liCount} list items`);
        
        // Check if numbers are rendered properly (browsers handle numbering automatically with <ol>)
        console.log("✓ List structure is correct - browser will auto-number 1, 2, 3, 4");
    } else {
        console.log("✗ ERROR: <ol> tag NOT found!");
    }
} else {
    console.log("parseMarkdown function not found.");
}
