(function() {
    'use strict';
    let bibleVerses = [];
    let devotionalActive = false;
    let versesLoaded = false;
    let currentAnimationFrameId = null;
    let isAnimating = false;
    async function loadBibleVerses() {
        if (versesLoaded) return bibleVerses;
        try {
            const response = await fetch('/blog/nt_verses_compact.json');
            if (!response.ok) throw new Error('Could not fetch Bible verses');
            const rawData = await response.json();
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
    function getRandomShortVerse() {
        if (bibleVerses.length === 0) return null;
        const shortVerses = bibleVerses.filter(v => v.text.length < 150);
        const pool = shortVerses.length > 0 ? shortVerses : bibleVerses;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    function cancelAnimation() {
        if (currentAnimationFrameId !== null) {
            cancelAnimationFrame(currentAnimationFrameId);
            currentAnimationFrameId = null;
        }
    }
    function typeDeleteAnimation(element, callback) {
        const text = element.textContent;
        let index = 0;
        let lastTime = 0;
        const interval = 15;
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
    function typeWriteAnimation(element, text, callback) {
        let index = 0;
        let lastTime = 0;
        const interval = 20;
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
    function stopAnimations() {
        cancelAnimation();
        devotionalActive = false;
        isAnimating = false;
    }
    async function runDevotional() {
        if (devotionalActive || isAnimating) return;
        devotionalActive = true;
        isAnimating = true;
        try {
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
            const verse = getRandomShortVerse();
            if (!verse) {
                devotionalActive = false;
                isAnimating = false;
                return;
            }
            const displayText = `${verse.text} — ${verse.book} ${verse.chapter}:${verse.verse} NRSVUE`;
            typeDeleteAnimation(leadParagraph, () => {
                typeWriteAnimation(leadParagraph, displayText, () => {
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
    async function monitorWarningAndStartDevotional() {
        function canStartDevotional() {
            const consentNow = localStorage.getItem('system_warning_consent') === 'true';
            const consentOverlay = document.getElementById('consent-overlay');
            const isOverlayGone = !consentOverlay || consentOverlay.style.display === 'none';
            const heroElement = document.getElementById('home-hero-content');
            return consentNow && isOverlayGone && heroElement;
        }
        const hasConsent = localStorage.getItem('system_warning_consent') === 'true';
        if (hasConsent) {
            const tryStart = async () => {
                const heroElement = document.getElementById('home-hero-content');
                if (heroElement && !devotionalActive && !isAnimating) {
                    await runDevotional();
                } else {
                    setTimeout(tryStart, 300);
                }
            };
            setTimeout(tryStart, 400);
            return;
        }
        document.addEventListener('warning:cleared', () => {
            setTimeout(async () => {
                await runDevotional();
            }, 300);
        }, {once: true});
        let pollCount = 0;
        const maxPolls = 10;
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
    window.monitorWarningAndStartDevotional = monitorWarningAndStartDevotional;
})();
