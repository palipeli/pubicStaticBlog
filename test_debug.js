const { parseMarkdown } = require('./js/markdown.js');

// Debug test for emphasis
console.log('Debug: *italic*');
const result = parseMarkdown('*italic*');
console.log('Result:', result);

// Check what character is before the asterisk
const text = '*italic*';
console.log('charBefore start:', text[0] === '*' ? '(start of string)' : text[-1]);
console.log('charAfter first *:', text[1]);
console.log('isWhitespaceAfter:', /\s/.test(text[1]));
console.log('isPunctuationAfter:', /[!\"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/.test(text[1]));
