// Test the proper fix for the cleanup regex

const testStr = "</pre></p>";
// The capture group includes the slash, so we need to NOT add another one
// But we also need to keep the closing angle bracket

// Option 1: Just use $1 (but this loses the >)
console.log("Option 1 - just $1:", testStr.replace(/<(\/\w+)>\\s*<\/p>/g, '$1'));

// Option 2: Change the regex to not capture the slash
const regex2 = /<\/(h[1-6]|ul|ol|li|pre|blockquote)>\s*<\/p>/g;
console.log("Option 2 - no slash in capture:", testStr.replace(regex2, '</$1>'));

// Option 3: Keep the original regex but fix the replacement
// Since $1 = "/pre", we want to output "</pre>" which is just "<" + $1 + ">"
const regex3 = /<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/g;
console.log("Option 3 - correct replacement:", testStr.replace(regex3, '<$1>'));

// Let's verify with more test cases
const testCases = [
    "</pre></p>",
    "</h1></p>",
    "</ul></p>",
    "</blockquote></p>"
];

console.log("\n=== Testing all cases with Option 3 ===");
testCases.forEach(tc => {
    console.log(`Input: ${JSON.stringify(tc)} -> Output: ${JSON.stringify(tc.replace(regex3, '<$1>'))}`);
});
