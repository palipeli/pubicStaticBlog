const { parseMarkdown } = require('./js/markdown.js');

// Manually test parseEmphasis logic
const text = '*italic*';
const start = 0;
const marker = text[start];

console.log('marker:', marker);

let startCount = 0;
let i = start;
while (i < text.length && text[i] === marker) {
    startCount++;
    i++;
}
console.log('startCount:', startCount);
console.log('i after counting:', i);

const charBefore = start > 0 ? text[start - 1] : '';
const charAfter = i < text.length ? text[i] : '';
console.log('charBefore:', JSON.stringify(charBefore));
console.log('charAfter:', JSON.stringify(charAfter));

const isWhitespaceBefore = charBefore === '' || /[ \t\n\r]/.test(charBefore);
const isWhitespaceAfter = charAfter === '' || /[ \t\n\r]/.test(charAfter);
const isPunctuationBefore = charBefore !== '' && /[!\"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/.test(charBefore);
const isPunctuationAfter = charAfter !== '' && /[!\"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/.test(charAfter);

console.log('isWhitespaceBefore:', isWhitespaceBefore);
console.log('isWhitespaceAfter:', isWhitespaceAfter);
console.log('isPunctuationBefore:', isPunctuationBefore);
console.log('isPunctuationAfter:', isPunctuationAfter);

const canOpen = !isWhitespaceAfter && (!isWhitespaceBefore || isPunctuationBefore);
console.log('canOpen:', canOpen);
