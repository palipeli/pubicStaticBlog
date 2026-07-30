


(function() {
    
    let bibleVerses = [];
    let devotionalActive = false;
    let versesLoaded = false;

    
    
    async function loadBibleVerses() {
        if (versesLoaded) return bibleVerses;

        try {
            const response = await fetch('/blog/nt_verses_clean.json');
            if (!response.ok) throw new Error('Could not fetch Bible verses');
            bibleVerses = await response.json();
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

    
    function typeDeleteAnimation(element, callback) {
        const text = element.textContent;
        let index = 0;

        function deleteChar() {
            if (index < text.length) {
                element.textContent = text.substring(0, text.length - index - 1);
                index++;
                setTimeout(deleteChar, 15); 
            } else {
                if (callback) callback();
            }
        }

        deleteChar();
    }

    
    function typeWriteAnimation(element, text, callback) {
        let index = 0;
        element.textContent = '';

        function typeChar() {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
                setTimeout(typeChar, 20); 
            } else {
                if (callback) callback();
            }
        }

        typeChar();
    }

    
    async function runDevotional() {
        if (devotionalActive) return;
        devotionalActive = true;

        
        await loadBibleVerses();

        if (bibleVerses.length === 0) {
            devotionalActive = false;
            return;
        }

        const heroElement = document.getElementById('home-hero-content');
        if (!heroElement) return;

        const leadParagraph = heroElement.querySelector('.home-lead');
        if (!leadParagraph) return;

        
        const verse = getRandomShortVerse();
        if (!verse) return;

        
        const displayText = `${verse.text} — ${verse.book} ${verse.chapter}:${verse.verse} NRSVUE`;

        
        typeDeleteAnimation(leadParagraph, () => {
            
            typeWriteAnimation(leadParagraph, displayText, () => {
                
            });
        });
    }

    
    function isWarningCleared() {
        
        const hasConsent = localStorage.getItem('system_warning_consent') === 'true';
        
        const consentOverlay = document.getElementById('consent-overlay');
        const isOverlayGone = !consentOverlay || consentOverlay.style.display === 'none';
        return hasConsent && isOverlayGone;
    }

    
    async function monitorWarningAndStartDevotional() {
        const checkInterval = setInterval(async () => {
            if (isWarningCleared()) {
                clearInterval(checkInterval);
                
                setTimeout(async () => {
                    await runDevotional();
                }, 300);
            }
        }, 100);
    }

    
    window.runDevotional = runDevotional;
    window.monitorWarningAndStartDevotional = monitorWarningAndStartDevotional;
    window.isWarningCleared = isWarningCleared;
    window.loadBibleVerses = loadBibleVerses;
    window.typeDeleteAnimation = typeDeleteAnimation;
    window.typeWriteAnimation = typeWriteAnimation;
    window.getRandomShortVerse = getRandomShortVerse;
})();
