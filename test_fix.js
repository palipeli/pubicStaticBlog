// Test the fix for the cleanup regex

const testStr = "</pre></p>";
const regex = /<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/g;

console.log("=== PROBLEM DEMONSTRATION ===");
console.log("Input:", JSON.stringify(testStr));
console.log("Match:", testStr.match(regex));
console.log("Replace with '</$1>' :", testStr.replace(regex, '</$1>'));
console.log("This produces '<//pre>' which is WRONG!");

console.log("\n=== THE FIX ===");
// The issue is that $1 captures the SLASH already, so we shouldn't add another one
// Let's verify:
const match = testStr.match(regex);
if (match) {
    const captureTest = testStr.match(/<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>/);
    console.log("Capture group 1:", JSON.stringify(captureTest[1]));
    // So $1 = "/pre", and '</$1>' becomes '</pre>' - wait that should be correct...
    // Let me re-test
    console.log("Manual replacement:", '</' + captureTest[1] + '>');
}

// Actually the issue might be different - let's check the actual string in context
const fullContext = "vpp.itunes.apple.com</code></pre></p>";
console.log("\nFull context test:");
console.log("Input:", JSON.stringify(fullContext));
console.log("After regex:", JSON.stringify(fullContext.replace(regex, '</$1>')));

// Wait, I see it now - the output shows <//pre> not </pre>
// That means the capture group must include something unexpected
// Let me check more carefully
const detailedRegex = /<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/g;
const detailedMatch = "</pre></p>".match(detailedRegex);
console.log("\nDetailed match:", detailedMatch);

// Try with exec to get capture groups
const execRegex = /<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/;
const execResult = execRegex.exec("</pre></p>");
console.log("Exec result:", execResult);
console.log("Group 0 (full match):", JSON.stringify(execResult[0]));
console.log("Group 1 (capture):", JSON.stringify(execResult[1]));
console.log("Replacement '</$1>' would produce:", JSON.stringify('</' + execResult[1] + '>'));

// OH! I see it now - the capture group IS "/pre" (with the slash)
// So '</$1>' becomes '</' + '/pre' + '>' = '<//pre>'
// The fix is to just use '$1' without the extra '</'
console.log("\n=== CORRECT FIX ===");
console.log("Using '$1' instead of '</$1>':", "</pre></p>".replace(execRegex, '$1'));
