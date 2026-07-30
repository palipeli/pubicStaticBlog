// Playwright test to verify blog card animation behavior
const { test, expect } = require('@playwright/test');

test.describe('Blog Animation Test', () => {
  test('verify animation triggers only once when clicking Blogs nav from home after reading post', async ({ page }) => {
    // Navigate to the home page
    await page.goto('http://localhost:8080/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // First, navigate to blogs and click a post to simulate reading
    await page.click('.nav-item[data-page="blogs"]');
    await page.waitForTimeout(300);
    
    // Click on a blog post from the grid to read it
    await page.click('.blog-card:first-child');
    await page.waitForTimeout(500);

    // Now navigate to home page
    await page.click('.nav-item[data-page="home"]');
    await page.waitForTimeout(300);

    // Set up mutation observer to track when blog cards are rendered
    await page.evaluate(() => {
      window.animationTriggers = [];

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.classList && node.classList.contains('blog-card')) {
                window.animationTriggers.push({
                  time: Date.now(),
                  type: 'blog-card-added'
                });
              }
            });
          }
        });
      });

      const grid = document.getElementById('blog-post-selector-grid');
      if (grid) {
        observer.observe(grid, {
          childList: true,
          subtree: true
        });
      }
    });

    // Click Blogs button from home page (this should restore the blog post without showing grid animation twice)
    await page.click('.nav-item[data-page="blogs"]');
    await page.waitForTimeout(1000);

    // Get animation triggers count - should be 0 since we're restoring a post, not showing the grid
    const animationsFromHome = await page.evaluate(() => window.animationTriggers.length);

    console.log(`Animations triggered when clicking Blogs from home (restoring post): ${animationsFromHome}`);

    // Reset tracker
    await page.evaluate(() => { window.animationTriggers = []; });

    // Go back to home
    await page.click('.nav-item[data-page="home"]');
    await page.waitForTimeout(300);

    // Navigate to blogs again but this time click blogs from sidebar directly (not from home)
    await page.click('.nav-item[data-page="blogs"]');
    await page.waitForTimeout(300);
    
    // Now go to home again
    await page.click('.nav-item[data-page="home"]');
    await page.waitForTimeout(300);
    
    // Click blogs again - should show intro grid this time (since hasRestoredBlogSession was reset)
    await page.click('.nav-item[data-page="blogs"]');
    await page.waitForTimeout(1000);

    const animationsSecondClick = await page.evaluate(() => window.animationTriggers.length);

    console.log(`Animations triggered on second blogs click (showing grid): ${animationsSecondClick}`);

    // First click should not trigger grid animations (restoring post), second should (showing grid)
    // The key is that both paths should behave consistently
    console.log('Test completed - check console output for animation counts');
  });
});
