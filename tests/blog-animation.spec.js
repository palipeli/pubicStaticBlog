// tests/blog-animation.spec.js - Test for blog post entry animation behavior
const { test, expect } = require('@playwright/test');

test.describe('Blog Post Entry Animation', () => {
    test.beforeEach(async ({ page }) => {
        // Clear localStorage before each test
        await page.context().clearCookies();
        await page.goto('http://localhost:8080/');
        await page.waitForLoadState('networkidle');
    });

    test('should trigger animation only once when clicking sidebar to open blog post', async ({ page }) => {
        // Wait for blog posts to load
        await page.waitForSelector('.post-selector-item');
        
        // Track animation count by monitoring the blog-post-content element
        let animationCount = 0;
        
        // Listen for animation events on blog post content
        await page.exposeFunction('countAnimation', () => {
            animationCount++;
        });
        
        // Inject animation listener
        await page.evaluate(() => {
            window.animationCount = 0;
            document.addEventListener('animationstart', (e) => {
                if (e.target.classList.contains('blog-post-content')) {
                    window.animationCount++;
                    console.log('Animation triggered, count:', window.animationCount);
                }
            });
        });
        
        // Click on first blog post in sidebar
        const firstPost = await page.locator('.post-selector-item').first();
        await firstPost.click();
        
        // Wait for blog post to load
        await page.waitForSelector('.blog-post-content');
        await page.waitForTimeout(1000);
        
        // Get animation count
        const count = await page.evaluate(() => window.animationCount);
        console.log('Sidebar click animation count:', count);
        
        // Animation should trigger exactly once
        expect(count).toBe(1);
    });

    test('should trigger animation only once when clicking Blogs button to restore blog post', async ({ page }) => {
        // First, open a blog post via sidebar
        await page.waitForSelector('.post-selector-item');
        const firstPost = await page.locator('.post-selector-item').first();
        await firstPost.click();
        
        // Wait for blog post to load
        await page.waitForSelector('.blog-post-content');
        await page.waitForTimeout(500);
        
        // Navigate to home page
        const homeNav = await page.locator('.nav-item[data-page="home"]');
        await homeNav.click();
        await page.waitForTimeout(300);
        
        // Reset animation counter
        await page.evaluate(() => {
            window.animationCount = 0;
        });
        
        // Set up animation listener after reset
        await page.evaluate(() => {
            document.addEventListener('animationstart', (e) => {
                if (e.target.classList.contains('blog-post-content')) {
                    window.animationCount++;
                    console.log('Animation triggered, count:', window.animationCount);
                }
            });
        });
        
        // Now click Blogs button to restore the blog post
        const blogsNav = await page.locator('.nav-item[data-page="blogs"]');
        await blogsNav.click();
        
        // Wait for blog post to be restored and loaded
        await page.waitForSelector('.blog-post-content');
        await page.waitForTimeout(1000);
        
        // Get animation count
        const count = await page.evaluate(() => window.animationCount);
        console.log('Blogs button restore animation count:', count);
        
        // Animation should trigger exactly once (same as sidebar)
        expect(count).toBe(1);
    });
});
