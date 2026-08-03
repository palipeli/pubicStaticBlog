// devotional.js - Bible Devotional and Typing Animations
// Lazy-loaded module for Bible verse display and typing effects

(function() {
    'use strict';

    // Bible Devotional state
    let bibleVerses = [];
    let devotionalActive = false;
    let versesLoaded = false;
    
    // Track animation frame IDs for cancellation
    let currentAnimationFrameId = null;
    let isAnimating = false;

    // Load Bible verses from pre-extracted JSON (compact array format for smaller size)
    // Only loads when needed to keep initial page load lightweight
    // Format: [book, chapter, verse, text]
    async function loadBibleVerses() {
        if (versesLoaded) return bibleVerses;

        try {
            const response = await fetch('/blog/nt_verses_compact.json');
            if (!response.ok) throw new Error('Could not fetch Bible verses');
            const rawData = await response.json();
            // Convert array format back to objects for compatibility
            bibleVerses = rawData.map(v => ({
                book: v[0],
                chapter: v[1],
                verse: v[2],
                text: v[3]
            }));
            versesLoaded = true;
            console.log(`Loaded ${bibleVerses.length} Bible verses`);
            return bibleVerses;
        } catch (err) {
            console.error('Error loading Bible verses:', err);
            bibleVerses = [];
            return [];
        }
    }

    // Get a random short verse (under 150 chars for display)
    function getRandomShortVerse() {
        if (bibleVerses.length === 0) return null;

        // Filter for shorter verses
        const shortVerses = bibleVerses.filter(v => v.text.length < 150);
        const pool = shortVerses.length > 0 ? shortVerses : bibleVerses;

        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Cancel any running animation
    function cancelAnimation() {
        if (currentAnimationFrameId !== null) {
            cancelAnimationFrame(currentAnimationFrameId);
            currentAnimationFrameId = null;
        }
    }

    // Typing delete animation - removes text character by character using rAF
    function typeDeleteAnimation(element, callback) {
        const text = element.textContent;
        let index = 0;
        let lastTime = 0;
        const interval = 15; // ms target interval

        function step(timestamp) {
            if (!lastTime) lastTime = timestamp;
            const delta = timestamp - lastTime;

            if (delta >= interval) {
                const charsToDelete = Math.max(1, Math.floor(delta / interval));
                index += charsToDelete;
                lastTime = timestamp;

                if (index < text.length) {
                    element.textContent = text.substring(0, text.length - index);
                } else {
                    element.textContent = '';
                    if (callback) callback();
                    return;
                }
            }
            currentAnimationFrameId = requestAnimationFrame(step);
        }

        currentAnimationFrameId = requestAnimationFrame(step);
    }

    // Typing write animation - types text character by character using rAF
    function typeWriteAnimation(element, text, callback) {
        let index = 0;
        let lastTime = 0;
        const interval = 20; // ms target interval
        element.textContent = '';

        function step(timestamp) {
            if (!lastTime) lastTime = timestamp;
            const delta = timestamp - lastTime;

            if (delta >= interval) {
                const charsToAdd = Math.max(1, Math.floor(delta / interval));
                index += charsToAdd;
                lastTime = timestamp;

                if (index <= text.length) {
                    element.textContent = text.substring(0, index);
                } else {
                    element.textContent = text;
                    if (callback) callback();
                    return;
                }
            }
            currentAnimationFrameId = requestAnimationFrame(step);
        }

        currentAnimationFrameId = requestAnimationFrame(step);
    }

    // Stop all animations and clean up
    function stopAnimations() {
        cancelAnimation();
        devotionalActive = false;
        isAnimating = false;
    }

    // Run the devotional - delete old text, type new verse
    async function runDevotional() {
        if (devotionalActive || isAnimating) return;
        devotionalActive = true;
        isAnimating = true;

        try {
            // Load verses on-demand when animation starts (lightweight initial load)
            await loadBibleVerses();

            if (bibleVerses.length === 0) {
                devotionalActive = false;
                isAnimating = false;
                return;
            }

            const heroElement = document.getElementById('home-hero-content');
            if (!heroElement) {
                devotionalActive = false;
                isAnimating = false;
                return;
            }

            const leadParagraph = heroElement.querySelector('.home-lead');
            if (!leadParagraph) {
                devotionalActive = false;
                isAnimating = false;
                return;
            }

            // Get random verse
            const verse = getRandomShortVerse();
            if (!verse) {
                devotionalActive = false;
                isAnimating = false;
                return;
            }

            // Format: "Verse text — Book Chapter:Verse NRSVUE"
            const displayText = `${verse.text} — ${verse.book} ${verse.chapter}:${verse.verse} NRSVUE`;

            // First, delete the existing text
            typeDeleteAnimation(leadParagraph, () => {
                // Then type the new verse
                typeWriteAnimation(leadParagraph, displayText, () => {
                    // Animation complete - reset flags
                    devotionalActive = false;
                    isAnimating = false;
                });
            });
        } catch (err) {
            console.error('Error in runDevotional:', err);
            devotionalActive = false;
            isAnimating = false;
        }
    }

    // Monitor for warning clearance and trigger devotional using event-based approach
    async function monitorWarningAndStartDevotional() {
        // Helper function to check if conditions are met to start devotional
        function canStartDevotional() {
            const consentNow = localStorage.getItem('system_warning_consent') === 'true';
            const consentOverlay = document.getElementById('consent-overlay');
            const isOverlayGone = !consentOverlay || consentOverlay.style.display === 'none';
            const heroElement = document.getElementById('home-hero-content');
            return consentNow && isOverlayGone && heroElement;
        }
        
        // Check if user has already given consent
        const hasConsent = localStorage.getItem('system_warning_consent') === 'true';
        
        if (hasConsent) {
            // User already accepted, start devotional after a short delay
            // Ensure DOM is fully loaded before starting
            const tryStart = async () => {
                const heroElement = document.getElementById('home-hero-content');
                if (heroElement && !devotionalActive && !isAnimating) {
                    await runDevotional();
                } else {
                    // Retry if hero element not found yet or animation in progress
                    setTimeout(tryStart, 300);
                }
            };
            setTimeout(tryStart, 400);
            // Early return - don't set up event listener or polling since user already consented
            return;
        }
        
        // Listen for the warning:cleared event from warning.js
        document.addEventListener('warning:cleared', () => {
            // Small delay to ensure UI is settled
            setTimeout(async () => {
                await runDevotional();
            }, 300);
        }, { once: true });
        
        // Polling mechanism: check periodically if conditions are met
        // This handles the case where warning.js clears consent before devotional.js loads
        let pollCount = 0;
        const maxPolls = 10; // Check up to 10 times (5 seconds total)
        const pollInterval = setInterval(() => {
            pollCount++;
            if (canStartDevotional() && !devotionalActive && !isAnimating) {
                clearInterval(pollInterval);
                runDevotional();
            } else if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
            }
        }, 500);
    }

    // Expose functions globally
    window.runDevotional = runDevotional;
    window.monitorWarningAndStartDevotional = monitorWarningAndStartDevotional;
})();
