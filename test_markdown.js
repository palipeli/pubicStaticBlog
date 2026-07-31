// Test script for markdown parser fixes
const { parseMarkdown } = require('./js/markdown.js');

console.log('=== Testing Markdown Parser Fixes ===\n');

// Test 1: Emphasis rules - *_test_* should NOT be emphasis (different delimiters)
console.log('Test 1: Emphasis with different delimiters');
const test1 = '*_test_*';
const result1 = parseMarkdown(test1);
console.log(`Input: ${test1}`);
console.log(`Output: ${result1}`);
console.log(`Expected: Should NOT have <em> tags (different delimiters)`);
console.log(`Pass: ${!result1.includes('<em>')}\n`);

// Test 2: Thematic break - ** alone should NOT be hr
console.log('Test 2: Thematic break detection');
const test2 = '**';
const result2 = parseMarkdown(test2);
console.log(`Input: "${test2}"`);
console.log(`Output: ${result2}`);
console.log(`Expected: Should be paragraph with **, not <hr>`);
console.log(`Pass: ${!result2.includes('<hr>')}\n`);

// Test 3: Autolink validation - www.example.com without protocol should NOT link
console.log('Test 3: Autolink validation');
const test3 = '<www.example.com>';
const result3 = parseMarkdown(test3);
console.log(`Input: ${test3}`);
console.log(`Output: ${result3}`);
console.log(`Expected: Should NOT be a link (no protocol)`);
console.log(`Pass: ${!result3.includes('<a href')}\n`);

// Test 4: Valid autolink with https
console.log('Test 4: Valid autolink');
const test4 = '<https://example.com>';
const result4 = parseMarkdown(test4);
console.log(`Input: ${test4}`);
console.log(`Output: ${result4}`);
console.log(`Expected: Should be a link`);
console.log(`Pass: ${result4.includes('<a href="https://example.com">')}\n`);

// Test 5: Image with title attribute
console.log('Test 5: Image with title attribute');
const test5 = '![alt](src.jpg "title here")';
const result5 = parseMarkdown(test5);
console.log(`Input: ${test5}`);
console.log(`Output: ${result5}`);
console.log(`Expected: Should have title attribute`);
console.log(`Pass: ${result5.includes('title="title here"')}\n`);

// Test 6: Backslash escapes
console.log('Test 6: Backslash escapes');
const test6 = '\\*not emphasis\\*';
const result6 = parseMarkdown(test6);
console.log(`Input: ${test6}`);
console.log(`Output: ${result6}`);
console.log(`Expected: Should show literal * characters`);
console.log(`Pass: ${result6.includes('*not emphasis*') && !result6.includes('<em>')}\n`);

// Test 7: Strong emphasis still works
console.log('Test 7: Strong emphasis');
const test7 = '**bold**';
const result7 = parseMarkdown(test7);
console.log(`Input: ${test7}`);
console.log(`Output: ${result7}`);
console.log(`Expected: Should have <strong> tags`);
console.log(`Pass: ${result7.includes('<strong>bold</strong>')}\n`);

// Test 8: Emphasis still works
console.log('Test 8: Emphasis');
const test8 = '*italic*';
const result8 = parseMarkdown(test8);
console.log(`Input: ${test8}`);
console.log(`Output: ${result8}`);
console.log(`Expected: Should have <em> tags`);
console.log(`Pass: ${result8.includes('<em>italic</em>')}\n`);

// Test 9: Mixed emphasis ***bold italic***
console.log('Test 9: Bold and italic');
const test9 = '***bold italic***';
const result9 = parseMarkdown(test9);
console.log(`Input: ${test9}`);
console.log(`Output: ${result9}`);
console.log(`Expected: Should have both <em> and <strong> tags`);
console.log(`Pass: ${result9.includes('<em>') && result9.includes('<strong>')}\n`);

console.log('=== All tests completed ===');
