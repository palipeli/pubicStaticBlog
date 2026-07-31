// Test *_test_* - should NOT be emphasis since delimiters don't match
const text = '*_test_*';

console.log('Testing:', text);
console.log('Position 0:', text[0], '(asterisk)');
console.log('Position 1:', text[1], '(underscore)');

// According to GFM, * can only close with *, _ can only close with _
// So *_test_* should NOT become emphasis because:
// - The opening * at position 0 should look for closing * 
// - But the content would be "_test_" which starts and ends with _
// - This is actually: * followed by _test_ (which IS valid emphasis for _) followed by *

// Let's trace what happens:
// 1. parseEmphasis sees * at position 0
// 2. It looks for matching * delimiter
// 3. It finds * at position 6
// 4. Content between is "_test_"
// 5. But wait - inside that content, there's a valid _test_ emphasis!

// The issue is that our parser is finding *...* with content "_test_"
// And then when parsing inline on "_test_", it correctly finds _test_ as emphasis

// Actually looking at GFM spec more carefully:
// *_test_* - this SHOULD be parsed as:
// - * at start opens emphasis
// - We need to find closing *
// - The _ characters inside are just regular characters from *'s perspective
// - Final * at position 6 closes
// - Content "_test_" gets parsed for inline, and _test_ becomes <em>test</em>

// So the output <p><em>_test_</em></p> means:
// - Outer <em> from *...*  
// - Inner _test_ is literal text (not emphasis because _ needs matching _)

// Wait no, the output shows <em>_test_</em> which means the outer * matched
// But the inner _ did NOT become emphasis... let me check again

// Actually I think the test expectation might be wrong. Let me check GFM spec.
// According to GFM, emphasis delimiters must match: * with *, _ with _
// But nested emphasis is allowed!

// *_test_* could be interpreted as:
// Option A: * opens, finds closing *, content is "_test_" which has no valid emphasis
// Option B: No emphasis at all because the pattern doesn't work

// Let me check what actual GFM parsers do...
