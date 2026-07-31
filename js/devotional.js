// devotional.js - Bible Devotional and Typing Animations
// Lazy-loaded module for Bible verse display and typing effects

(function() {
    // Bible Devotional state
    let bibleVerses = [];
    let devotionalActive = false;
    let versesLoaded = false;

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

    // Typing delete animation - removes text character by character
    function typeDeleteAnimation(element, callback) {
        const text = element.textContent;
        let index = 0;

        function deleteChar() {
            if (index < text.length) {
                element.textContent = text.substring(0, text.length - index - 1);
                index++;
                setTimeout(deleteChar, 15); // Fast deletion
            } else {
                if (callback) callback();
            }
        }

        deleteChar();
    }

    // Typing write animation - types text character by character
    function typeWriteAnimation(element, text, callback) {
        let index = 0;
        element.textContent = '';

        function typeChar() {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
                setTimeout(typeChar, 20); // Fast typing
            } else {
                if (callback) callback();
            }
        }

        typeChar();
    }

    // Prevent concurrent animations from running
    let isAnimating = false;

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

    // Check if warning has been accepted/cleared
    function isWarningCleared() {
        // Check localStorage for consent
        const hasConsent = localStorage.getItem('system_warning_consent') === 'true';
        // Also check if consent overlay is gone
        const consentOverlay = document.getElementById('consent-overlay');
        const isOverlayGone = !consentOverlay || consentOverlay.style.display === 'none';
        return hasConsent && isOverlayGone;
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
    window.isWarningCleared = isWarningCleared;
    window.loadBibleVerses = loadBibleVerses;
    window.typeDeleteAnimation = typeDeleteAnimation;
    window.typeWriteAnimation = typeWriteAnimation;
    window.getRandomShortVerse = getRandomShortVerse;
})();
