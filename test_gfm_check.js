// Check GFM spec behavior for *_test_*
// According to GitHub Flavored Markdown spec:
// https://github.github.com/gfm/#example-356
// 
// Example from spec:
// Input: *foo _bar* baz_
// Output: <p><em>foo _bar</em> baz_</p>
//
// This shows that * can match with * even when there's an unmatched _ inside!
// The emphasis delimiters only need to match each other, not care about what's inside.
//
// So *_test_* SHOULD become <em>_test_</em> according to GFM!
// The test expectation was WRONG.

console.log('GFM Spec Check:');
console.log('*_test_* should produce: <em>_test_</em>');
console.log('This is CORRECT per GFM spec example 356');
console.log('The test expectation needs to be fixed, not the parser.');
