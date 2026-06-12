const DEFENSE_VERSION = "2.0";
const DEFENSE_TIMESTAMP = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 14));
const DEFENSE_SALT = "pippo2644_secret_" + DEFENSE_TIMESTAMP;

const DEFENSE_VARIANTS = {
    0: function() {
        let score = 0;
        if (navigator.webdriver === true) score += 10;
        if (navigator.userAgent.toLowerCase().includes("headless")) score += 10;
        if (navigator.plugins && navigator.plugins.length === 0) score += 5;
        if (!navigator.languages || navigator.languages.length === 0) score += 5;
        return score > 15;
    },
    1: function() {
        let score = 0;
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    if (renderer && (renderer.toLowerCase().includes('swiftshader') || renderer.toLowerCase().includes('llvmpipe'))) score += 10;
                }
            }
        } catch(e) { score += 5; }
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 2) score += 5;
        if (!window.chrome && !navigator.brave) score += 5;
        return score > 10;
    },
    2: function() {
        let score = 0;
        if (window.outerWidth === 0 || window.outerHeight === 0) score += 10;
        if (screen.width < 800 || screen.height < 600) score += 5;
        if (!document.hidden) score += 3;
        if (performance && performance.timing) {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            if (loadTime < 200) score += 8;
        }
        return score > 12;
    },
    3: function() {
        let score = 0;
        if (sessionStorage.getItem('honeypot_clicked') === 'true') score += 20;
        if (localStorage.getItem('bot_detected') === 'true') score += 15;
        if (!navigator.cookieEnabled) score += 8;
        if (window.__playwright__ === true) score += 10;
        if (window.__webdriver_evaluate) score += 10;
        return score > 15;
    }
};

const variantIndex = DEFENSE_TIMESTAMP % Object.keys(DEFENSE_VARIANTS).length;
const IS_BOT = DEFENSE_VARIANTS[variantIndex]();

(function setupHoneypot() {
    const honeypot = document.createElement('div');
    honeypot.id = 'honeypot-link-' + DEFENSE_TIMESTAMP;
    honeypot.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:1px; height:1px; opacity:0;';
    honeypot.innerHTML = '<a href="#" id="fake-download-link-' + DEFENSE_TIMESTAMP + '">Download</a>';
    document.body.appendChild(honeypot);
    
    const fakeLink = document.getElementById('fake-download-link-' + DEFENSE_TIMESTAMP);
    if (fakeLink) {
        fakeLink.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.setItem('honeypot_clicked', 'true');
            sessionStorage.setItem('flagged_as_bot', 'true');
            localStorage.setItem('bot_detected', 'true');
            document.body.innerHTML = '<h1 style="color:red; text-align:center; margin-top:20%;">Access Denied</h1><p>Automated access detected. Your IP has been logged.</p>';
            throw new Error("Bot detected via honeypot");
        });
    }
})();

let mouseMoved = false;
let touchEvents = false;
document.addEventListener('mousemove', () => { mouseMoved = true; });
document.addEventListener('touchstart', () => { touchEvents = true; });

const startTime = Date.now();
setTimeout(() => {
    const timeSpent = Date.now() - startTime;
    if (timeSpent < 2000 && !mouseMoved && !touchEvents && !IS_BOT) {
        sessionStorage.setItem('flagged_as_bot', 'true');
    }
}, 3000);

if (IS_BOT || sessionStorage.getItem('flagged_as_bot') === 'true') {
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        if (args[0] && String(args[0]).includes('exFAT.json')) {
            console.warn("[Anti-Scraper] Blocked exFAT.json request");
            return Promise.reject(new Error("Access denied"));
        }
        return originalFetch.apply(this, args);
    };
    
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (url && String(url).includes('exFAT.json')) {
            throw new Error("Access denied");
        }
        return originalOpen.call(this, method, url, ...rest);
    };
}

function generateFakeGames(count) {
    const fakeTitles = ["FAKE_SCANNER_TRAP", "HONEYPOT_DETECTED", "SCRAPER_BLOCKED", "ACCESS_DENIED_001", "BOT_TRAP_ACTIVE", "DUMMY_DATA_INJECTED", "ANTI_SCRAPER_2026", "PIPPO_TRAP_" + DEFENSE_TIMESTAMP];
    const fakeHosts = ['https://httpbin.org/status/404', 'https://example.com/fake', 'https://httpbin.org/delay/10'];
    const fakeGames = [];
    for (let i = 0; i < count; i++) {
        fakeGames.push({
            title: `${fakeTitles[i % fakeTitles.length]}_${i}_${DEFENSE_TIMESTAMP}`,
            image: "https://placehold.co/400x400/0a0a1a/red?text=SCRAPER+BLOCKED",
            size: "999 GB",
            tags: ["FAKE", "HONEYPOT", "BLOCKED", "DELETE_ME"],
            akia_url: fakeHosts[i % fakeHosts.length],
            viki_url: fakeHosts[(i+1) % fakeHosts.length],
            buzz_url: fakeHosts[(i+2) % fakeHosts.length],
            data_url: fakeHosts[(i+3) % fakeHosts.length],
            credits_files: "Anti-Scraper System v" + DEFENSE_VERSION,
            credits_backport: "Detection active",
            how_to_play: "You are a bot. Access denied. Your activity has been logged.",
            popular: i < 5 ? "on" : "off"
        });
    }
    return fakeGames;
}

let allGames = [];
let filteredGames = [];
let originalOrderMap = new Map();
let allUpdates = {}; 
let currentPage = 1;
let isDragging = false;
let animationId = null;
let currentPosition = 0;
let hasMoved = false;
let integrityCheckInterval = null;
let protectionInterval = null;
let rememberAccess = false;
const itemsPerPage = 21;
const SECRET_HASH = "a2242ead55c94c3deb7cf2340bfef9d5bcaca22dfe66e646745ee4371c633fc8";

let searchTimeout = null;
let isRandomModeActive = false;
let isTransitioning = false;
let cachedPopularGames = null;
let cachedIsMobile = null;
let isLoading = true;

let pegasusDecryptCache = new Map();
let cachedAprEmuFiles = null;

const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
const originalGetItem = sessionStorage.getItem.bind(sessionStorage);
const originalRemoveItem = sessionStorage.removeItem.bind(sessionStorage);

sessionStorage.setItem = function(key, value) {
    if (key === 'unlocked' && value === SECRET_HASH) {
        const stack = new Error().stack;
        if (!stack.includes('checkSitePassword') && !stack.includes('init')) {
            console.warn('🚨 Tentativo di bypass password rilevato!');
            return;
        }
    }
    if (key === 'unlocked_time') {
        const stack = new Error().stack;
        if (!stack.includes('checkSitePassword')) {
            console.warn('🚨 Tentativo di bypass timestamp rilevato!');
            return;
        }
    }
    return originalSetItem(key, value);
};

sessionStorage.removeItem = function(key) {
    if (key === 'unlocked' || key === 'unlocked_time') {
        const stack = new Error().stack;
        if (!stack.includes('location.reload') && !stack.includes('startProtection')) {
            console.warn('🚨 Tentativo di rimozione illegittima rilevato!');
            return;
        }
    }
    return originalRemoveItem(key);
};

function checkIntegrity() {
    try {
        if (typeof SECRET_HASH !== 'string' || SECRET_HASH.length !== 64) {
            sessionStorage.removeItem('unlocked');
            sessionStorage.removeItem('unlocked_time');
            location.reload();
            return false;
        }
        if (typeof init !== 'function') {
            sessionStorage.removeItem('unlocked');
            sessionStorage.removeItem('unlocked_time');
            location.reload();
            return false;
        }
        return true;
    } catch(e) {
        sessionStorage.removeItem('unlocked');
        sessionStorage.removeItem('unlocked_time');
        location.reload();
        return false;
    }
}

function startIntegrityCheck() {
    if (integrityCheckInterval) clearInterval(integrityCheckInterval);
    integrityCheckInterval = setInterval(() => {
        const unlocked = originalGetItem('unlocked');
        if (unlocked === SECRET_HASH) {
            if (!checkIntegrity()) {
                alert("⚠️ Rilevata manipolazione! La pagina verrà ricaricata.");
                location.reload();
            }
        }
    }, 3000);
}

function setupHintCountdown() {
    const hintElement = document.querySelector('.search-hint');
    if (!hintElement) return;
    const delayMilliseconds = 5000;
    setTimeout(() => {
        hintElement.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        hintElement.style.opacity = '0';
        hintElement.style.transform = 'translateY(30px)';
        setTimeout(() => {
            if (hintElement && hintElement.parentNode) hintElement.style.display = 'none';
        }, 600);
    }, delayMilliseconds);
}

function showSkeletonLoader() {
    const grid = document.getElementById('game-grid');
    if (!grid) return;
    const skeletonHTML = Array(21).fill(0).map(() => `<div class="skeleton-card"><div class="skeleton-title shimmer"></div><div class="skeleton-image shimmer"></div><div class="skeleton-download shimmer"></div><div class="skeleton-download shimmer" style="width: 80%;"></div></div>`).join('');
    grid.innerHTML = skeletonHTML;
}

function hideSkeletonLoader() {
    const skeletons = document.querySelectorAll('.skeleton-card');
    skeletons.forEach(s => s.remove());
}

function scrollToTop(smooth = true) {
    if (!smooth) { window.scrollTo(0, 0); return; }
    const startPosition = window.pageYOffset;
    const targetPosition = 0;
    const distance = startPosition - targetPosition;
    const duration = 600;
    let startTime = null;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const easeProgress = easeOutCubic(progress);
        window.scrollTo(0, startPosition - (distance * easeProgress));
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }
    requestAnimationFrame(animation);
}

function showBackToTopButton() {
    const existingBtn = document.getElementById('backToTopBtn');
    if (existingBtn) return;
    const btn = document.createElement('div');
    btn.id = 'backToTopBtn';
    btn.className = 'back-to-top';
    btn.onclick = () => scrollToTop(true);
    document.body.appendChild(btn);
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) btn.classList.add('visible');
        else btn.classList.remove('visible');
    });
}

function updateResultCount() {
    const count = filteredGames.length;
    const container = document.getElementById('result-count-text');
    if (container) container.textContent = `${count} game${count !== 1 ? 's' : ''} found`;
}

function sizeToBytes(sizeStr) {
    if (!sizeStr) return 0;
    const match = sizeStr.match(/^([\d\.]+)\s*(B|KB|MB|GB|TB)$/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const multipliers = { 'B': 1, 'KB': 1024, 'MB': 1048576, 'GB': 1073741824, 'TB': 1099511627776 };
    return value * (multipliers[unit] || 0);
}

function sortGames(games, sortType) {
    const sorted = [...games];
    switch(sortType) {
        case 'az': return sorted.sort((a, b) => a.title.localeCompare(b.title));
        case 'za': return sorted.sort((a, b) => b.title.localeCompare(a.title));
        case 'size-asc': return sorted.sort((a, b) => sizeToBytes(a.size) - sizeToBytes(b.size));
        case 'size-desc': return sorted.sort((a, b) => sizeToBytes(b.size) - sizeToBytes(a.size));
        case 'popular': return sorted.filter(g => g.popular === "on");
        case 'default': return sorted.sort((a, b) => (originalOrderMap.get(a.title) || 0) - (originalOrderMap.get(b.title) || 0));
        default: return sorted;
    }
}

function applySorting() {
    const sortValue = document.getElementById('sort-filter').value;
    const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
    let tempFiltered = [...allGames];
    if (selectedFW !== 99) {
        tempFiltered = tempFiltered.filter(g => {
            let gameFW = 1;
            if (g.tags && g.tags.length > 0) {
                let foundVersions = [];
                g.tags.forEach(tag => {
                    const matches = tag.match(/(\d+)\.xx/gi);
                    if (matches) matches.forEach(m => { const num = parseInt(m.match(/\d+/)[0], 10); foundVersions.push(num); });
                });
                if (foundVersions.length > 0) gameFW = Math.min(...foundVersions);
            }
            return gameFW <= selectedFW;
        });
    }
    filteredGames = sortGames(tempFiltered, sortValue);
    currentPage = 1;
    renderGames();
    updateResultCount();
}

function setupSortDropdown() {
    const sortDropdown = document.getElementById('sort-dropdown');
    if (!sortDropdown) return;
    const trigger = sortDropdown.querySelector('.dropdown-trigger');
    const optionsContainer = document.getElementById('sort-options');
    const currentText = document.getElementById('sort-current');
    const hiddenInput = document.getElementById('sort-filter');
    const allOptions = sortDropdown.querySelectorAll('.option');
    trigger.onclick = (e) => { e.stopPropagation(); optionsContainer.classList.toggle('show'); sortDropdown.classList.toggle('active'); };
    allOptions.forEach(opt => {
        opt.onclick = () => {
            const val = opt.getAttribute('data-value');
            const label = opt.innerText;
            currentText.innerText = label;
            hiddenInput.value = val;
            optionsContainer.classList.remove('show');
            sortDropdown.classList.remove('active');
            const mobileHidden = document.getElementById('mobile-sort-filter');
            const mobileCurrent = document.getElementById('mobile-sort-current');
            if (mobileHidden) mobileHidden.value = val;
            if (mobileCurrent) mobileCurrent.innerText = label;
            applySorting();
        };
    });
    const mobileSortDropdown = document.getElementById('mobile-sort-dropdown');
    if (mobileSortDropdown) {
        const mobileTrigger = mobileSortDropdown.querySelector('.dropdown-trigger');
        const mobileOptions = document.getElementById('mobile-sort-options');
        const mobileCurrent = document.getElementById('mobile-sort-current');
        const mobileHidden = document.getElementById('mobile-sort-filter');
        mobileTrigger.onclick = (e) => { e.stopPropagation(); mobileOptions.classList.toggle('show'); mobileSortDropdown.classList.toggle('active'); };
        mobileOptions.querySelectorAll('.option').forEach(opt => {
            opt.onclick = () => {
                const val = opt.getAttribute('data-value');
                const label = opt.innerText;
                mobileCurrent.innerText = label;
                mobileHidden.value = val;
                if (hiddenInput) hiddenInput.value = val;
                if (currentText) currentText.innerText = label;
                mobileOptions.classList.remove('show');
                mobileSortDropdown.classList.remove('active');
                applySorting();
            };
        });
    }
    window.addEventListener('click', () => { optionsContainer.classList.remove('show'); sortDropdown.classList.remove('active'); if (mobileSortDropdown) { const mobileOpts = document.getElementById('mobile-sort-options'); if (mobileOpts) mobileOpts.classList.remove('show'); mobileSortDropdown.classList.remove('active'); } });
}

function applyFWFilterWithSort() {
    const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
    const sortValue = document.getElementById('sort-filter').value;
    let tempFiltered = [...allGames];
    if (selectedFW !== 99) {
        tempFiltered = tempFiltered.filter(g => {
            let gameFW = 1;
            if (g.tags && g.tags.length > 0) {
                let foundVersions = [];
                g.tags.forEach(tag => {
                    const matches = tag.match(/(\d+)\.xx/gi);
                    if (matches) matches.forEach(m => { const num = parseInt(m.match(/\d+/)[0], 10); foundVersions.push(num); });
                });
                if (foundVersions.length > 0) gameFW = Math.min(...foundVersions);
            }
            return gameFW <= selectedFW;
        });
    }
    filteredGames = sortGames(tempFiltered, sortValue);
    updateResultCount();
}

function parseSizeBytesFromString(sizeStr) {
    if (!sizeStr) return null;
    const match = sizeStr.match(/(\d+(?:[.,]\d+)?)\s*(KB|MB|GB|TB)/i);
    if (!match) return null;
    const value = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toUpperCase();
    const multipliers = { KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 };
    return Math.round(value * (multipliers[unit] || 1));
}

async function convertSingleGame(game, itemNumber, warnings, originalDecrypt) {
    const packages = [];
    const title = game.title || '';
    const tags = game.tags || [];
    
    let titleId = null;
    for (const tag of tags) {
        const match = tag.match(/\b([A-Z]{4}\d{5})\b/);
        if (match) {
            titleId = match[1];
            break;
        }
    }
    
    if (!title) {
        warnings.push(`item ${itemNumber}: title is required`);
        return packages;
    }
    
    const groupedLinks = new Map();
    const seen = new Set();
    
    for (const [key, value] of Object.entries(game)) {
        if (typeof value !== 'string') continue;
        if (!value.startsWith('http://') && !value.startsWith('https://')) continue;
        
        let decodedUrl = value;
        if (window.PippoExfatConverter && PippoExfatConverter.isLinkLockUrl && PippoExfatConverter.isLinkLockUrl(value)) {
            if (pegasusDecryptCache.has(value)) {
                decodedUrl = pegasusDecryptCache.get(value);
            } else {
                try {
                    decodedUrl = await originalDecrypt(value);
                    pegasusDecryptCache.set(value, decodedUrl);
                } catch (error) {
                    warnings.push(`${title}: could not decrypt ${key}: ${error.message}`);
                    continue;
                }
            }
        }
        
        let group = 'files';
        let mirror = key;
        
        if (key.includes('standard')) group = 'standard';
        else if (key.includes('backport')) group = 'backport';
        else if (key.includes('dlc')) group = 'dlc';
        else if (key.includes('dump')) group = 'dump';
        
        if (key.includes('akia')) mirror = 'akia';
        else if (key.includes('viki')) mirror = 'viki';
        else if (key.includes('buzz')) mirror = 'buzz';
        else if (key.includes('data')) mirror = 'data';
        
        let name = mirror.charAt(0).toUpperCase() + mirror.slice(1);
        if (group !== 'files') {
            name = `${group.charAt(0).toUpperCase() + group.slice(1)} - ${name}`;
        }
        
        const dedupeKey = `${group}\0${name.toLowerCase()}\0${decodedUrl}`;
        if (seen.has(dedupeKey)) continue;
        if (!groupedLinks.has(group)) groupedLinks.set(group, []);
        groupedLinks.get(group).push({ name, url: decodedUrl });
        seen.add(dedupeKey);
    }
    
    const allLinks = [];
    for (const [group, links] of groupedLinks) {
        for (const link of links) {
            allLinks.push(link);
        }
    }
    
    if (allLinks.length === 0) {
        return packages;
    }
    
    const descLines = [];
    if (tags && tags.length) descLines.push(`Tags: ${tags.join(', ')}`);
    if (game.size) descLines.push(`Size: ${game.size}`);
    const credits = [];
    if (game.credits_files) credits.push(`Files: ${game.credits_files}`);
    if (game.credits_backport) credits.push(`Backport: ${game.credits_backport}`);
    if (credits.length) descLines.push(`Credits: ${credits.join('; ')}`);
    if (game.how_to_play) descLines.push(`How to play: ${game.how_to_play}`);
    
    packages.push({
        titleId: titleId || `GAME_${itemNumber}`,
        title: title,
        version: "1.0",
        category: "game",
        posterUrl: game.image || null,
        description: descLines.join('\n'),
        downloadLinks: allLinks,
        sizeBytes: parseSizeBytesFromString(game.size)
    });
    
    return packages;
}

async function convertExFatToPegasusDirect() {
    if (!allGames || allGames.length === 0) {
        alert("No game data loaded. Please wait for the library to load.");
        return;
    }
    
    const convertBtn = document.getElementById('convertPegasusBtn');
    if (!convertBtn) return;
    
    const originalText = convertBtn.innerHTML;
    const originalBackground = convertBtn.style.background;
    const totalGames = allGames.length;
    
    let animationInterval = null;
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    
    const startSpinner = () => {
        animationInterval = setInterval(() => {
            if (convertBtn.disabled) {
                const currentPercent = convertBtn.innerHTML.match(/\d+/);
                const percent = currentPercent ? currentPercent[0] : '0';
                convertBtn.innerHTML = `${spinnerFrames[frameIndex]} ${percent}%`;
                frameIndex = (frameIndex + 1) % spinnerFrames.length;
            }
        }, 100);
    };
    
    const stopSpinner = () => {
        if (animationInterval) {
            clearInterval(animationInterval);
            animationInterval = null;
        }
    };
    
    convertBtn.innerHTML = '⠋ 0%';
    convertBtn.disabled = true;
    convertBtn.style.background = 'linear-gradient(135deg, #ff8800, #ff5500)';
    convertBtn.style.transform = 'scale(0.98)';
    convertBtn.classList.add('converting-pulse');
    
    startSpinner();
    
    try {
        const originalDecrypt = window.PippoExfatConverter ? PippoExfatConverter.decryptLinkLockUrl : (url) => url;
        const allPackages = [];
        const warnings = [];
        
        for (let i = 0; i < allGames.length; i++) {
            const game = allGames[i];
            const current = i + 1;
            const percent = Math.round((current / totalGames) * 100);
            const currentSpinner = convertBtn.innerHTML.charAt(0);
            convertBtn.innerHTML = `${currentSpinner} ${percent}%`;
            const result = await convertSingleGame(game, current, warnings, originalDecrypt);
            allPackages.push(...result);
        }
        
        stopSpinner();
        
        convertBtn.innerHTML = '📦 Creating JSON...';
        convertBtn.classList.remove('converting-pulse');
        
        const catalog = {
            name: "exFAT Pegasus",
            version: 1,
            packages: allPackages,
            _generated: new Date().toISOString(),
            _stats: { totalItems: allGames.length, totalPackages: allPackages.length }
        };
        
        const jsonStr = JSON.stringify(catalog, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exFAT-Pegasus.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        convertBtn.innerHTML = '✅ DOWNLOADED!';
        convertBtn.style.background = 'linear-gradient(135deg, #39ff14, #00cc00)';
        convertBtn.style.transform = 'scale(1.05)';
        convertBtn.classList.add('success-pulse');
        
        createSuccessParticles(convertBtn);
        
        setTimeout(() => {
            convertBtn.innerHTML = originalText;
            convertBtn.style.background = originalBackground || 'linear-gradient(135deg, var(--cyan-neon), #0099cc)';
            convertBtn.style.transform = 'scale(1)';
            convertBtn.disabled = false;
            convertBtn.classList.remove('success-pulse');
        }, 2500);
        
    } catch (error) {
        console.error('Conversion error:', error);
        stopSpinner();
        
        convertBtn.innerHTML = '❌ FAILED!';
        convertBtn.style.background = 'linear-gradient(135deg, #ff0033, #cc0000)';
        convertBtn.style.transform = 'scale(0.95)';
        convertBtn.classList.remove('converting-pulse');
        convertBtn.classList.add('error-shake');
        
        setTimeout(() => {
            convertBtn.innerHTML = originalText;
            convertBtn.style.background = originalBackground || 'linear-gradient(135deg, var(--cyan-neon), #0099cc)';
            convertBtn.style.transform = 'scale(1)';
            convertBtn.disabled = false;
            convertBtn.classList.remove('error-shake');
        }, 2500);
    }
}

function createSuccessParticles(button) {
    const rect = button.getBoundingClientRect();
    const colors = ['#39ff14', '#00ffee', '#ffffff', '#ffcc00'];
    
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: fixed;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top + rect.height / 2}px;
            width: 6px;
            height: 6px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: 50%;
            pointer-events: none;
            z-index: 100001;
            box-shadow: 0 0 8px currentColor;
        `;
        document.body.appendChild(particle);
        
        const angle = (Math.PI * 2 * i) / 12;
        const velocity = 50 + Math.random() * 30;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        
        let posX = rect.left + rect.width / 2;
        let posY = rect.top + rect.height / 2;
        let opacity = 1;
        let size = 6;
        
        const animateParticle = () => {
            posX += vx * 0.03;
            posY += vy * 0.03;
            opacity -= 0.02;
            size -= 0.1;
            
            particle.style.left = `${posX}px`;
            particle.style.top = `${posY}px`;
            particle.style.opacity = opacity;
            particle.style.width = `${Math.max(0, size)}px`;
            particle.style.height = `${Math.max(0, size)}px`;
            
            if (opacity > 0 && size > 0) {
                requestAnimationFrame(animateParticle);
            } else {
                particle.remove();
            }
        };
        
        requestAnimationFrame(animateParticle);
    }
}

function setupToolDropdown() {
    const toolDropdown = document.getElementById('tool-dropdown');
    if (!toolDropdown) return;
    const trigger = toolDropdown.querySelector('.dropdown-trigger');
    const optionsContainer = document.getElementById('tool-options');
    const allOptions = toolDropdown.querySelectorAll('.option');
    trigger.onclick = (e) => { e.stopPropagation(); optionsContainer.classList.toggle('show'); toolDropdown.classList.toggle('active'); };
    allOptions.forEach(opt => {
        opt.onclick = () => {
            const val = opt.getAttribute('data-value');
            optionsContainer.classList.remove('show');
            toolDropdown.classList.remove('active');
            if (val === 'pegasus-dl') openToolModal('pegasus');
            else if (val === 'exfat-ripper') openToolModal('ripper');
            else if (val === 'spectrum') openToolModal('spectrum');
        };
    });
    window.addEventListener('click', () => { optionsContainer.classList.remove('show'); toolDropdown.classList.remove('active'); });
    
    const mobileToolDropdown = document.getElementById('mobile-tool-dropdown');
    if (mobileToolDropdown) {
        const mobileTrigger = mobileToolDropdown.querySelector('.dropdown-trigger');
        const mobileOptions = document.getElementById('mobile-tool-options');
        mobileTrigger.onclick = (e) => { e.stopPropagation(); mobileOptions.classList.toggle('show'); mobileToolDropdown.classList.toggle('active'); };
        mobileOptions.querySelectorAll('.option').forEach(opt => {
            opt.onclick = () => {
                const val = opt.getAttribute('data-value');
                mobileOptions.classList.remove('show');
                mobileToolDropdown.classList.remove('active');
                if (val === 'pegasus-dl') openToolModal('pegasus');
                else if (val === 'exfat-ripper') openToolModal('ripper');
                else if (val === 'spectrum') openToolModal('spectrum');
            };
        });
    }
}

function setupToolModal() {
    const modalPegasus = document.getElementById('tool-modal');
    const closeBtnPegasus = document.getElementById('close-tool-modal');
    if (closeBtnPegasus) closeBtnPegasus.onclick = () => closeToolModal(modalPegasus);
    if (modalPegasus) modalPegasus.addEventListener('click', (e) => { if (e.target === modalPegasus) closeToolModal(modalPegasus); });
    
    const modalRipper = document.getElementById('tool-modal-ripper');
    const closeBtnRipper = document.getElementById('close-tool-modal-ripper');
    if (closeBtnRipper) closeBtnRipper.onclick = () => closeToolModal(modalRipper);
    if (modalRipper) modalRipper.addEventListener('click', (e) => { if (e.target === modalRipper) closeToolModal(modalRipper); });
    
    const modalSpectrum = document.getElementById('tool-modal-spectrum');
    const closeBtnSpectrum = document.getElementById('close-tool-modal-spectrum');
    if (closeBtnSpectrum) closeBtnSpectrum.onclick = () => closeToolModal(modalSpectrum);
    if (modalSpectrum) modalSpectrum.addEventListener('click', (e) => { if (e.target === modalSpectrum) closeToolModal(modalSpectrum); });
    
    const convertBtn = document.getElementById('convertPegasusBtn');
    if (convertBtn && !convertBtn.hasListener) {
        convertBtn.addEventListener('click', convertExFatToPegasusDirect);
        convertBtn.hasListener = true;
    }
}

function closeToolModal(modal) {
    if (!modal) return;
    modal.classList.add('hiding');
    const container = modal.querySelector('.tool-modal-container');
    if (container) container.classList.add('closing');
    setTimeout(() => {
        modal.classList.remove('show', 'hiding');
        if (container) container.classList.remove('closing');
    }, 300);
}

function openToolModal(toolName) {
    let modalId;
    if (toolName === 'pegasus') {
        modalId = 'tool-modal';
    } else if (toolName === 'ripper') {
        modalId = 'tool-modal-ripper';
    } else if (toolName === 'spectrum') {
        modalId = 'tool-modal-spectrum';
    } else {
        return;
    }
    
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hiding');
        const container = modal.querySelector('.tool-modal-container');
        if (container) container.classList.remove('closing');
        modal.classList.add('show');
        
        if (toolName === 'pegasus') {
            setTimeout(() => {
                const convertBtn = document.getElementById('convertPegasusBtn');
                if (convertBtn && !convertBtn.hasListener) {
                    convertBtn.addEventListener('click', convertExFatToPegasusDirect);
                    convertBtn.hasListener = true;
                }
            }, 100);
        }
    }
}

// ========== APR-EMU FUNCTIONS ==========

async function loadAprEmuFiles() {
    if (cachedAprEmuFiles) return cachedAprEmuFiles;
    
    try {
        // Prova a caricare il manifest.json
        const manifestRes = await fetch('ampr-emu-drakmor/manifest.json');
        if (manifestRes.ok) {
            const manifest = await manifestRes.json();
            if (manifest.files && Array.isArray(manifest.files)) {
                console.log('APR-EMU files loaded from manifest:', manifest.files);
                cachedAprEmuFiles = manifest.files;
                return cachedAprEmuFiles;
            }
        }
        
        // Se manifest non trovato o malformato, mostra errore
        console.error('manifest.json non trovato o malformato');
        cachedAprEmuFiles = [];
        return [];
        
    } catch (error) {
        console.error('Error loading APR-EMU files:', error);
        cachedAprEmuFiles = [];
        return [];
    }
}

window.openAprEmuModal = async function() {
    const modal = document.getElementById('aprEmuModal');
    const bodyContainer = document.getElementById('aprEmuModalBody');
    
    if (!modal || !bodyContainer) return;
    
    modal.classList.remove('hiding');
    const container = modal.querySelector('.apr-emu-modal-container');
    if (container) container.classList.remove('closing');
    
    bodyContainer.innerHTML = '<div style="text-align:center; padding:20px;">📡 Loading APR-EMU files...</div>';
    modal.classList.add('show');
    
    const files = await loadAprEmuFiles();
    
    const getVersionNum = (filename) => {
        const match = filename.match(/^([\d\.]+)\/libSceAmpr\.sprx/);
        if (match) {
            const parts = match[1].split('.');
            return parts.map(p => parseInt(p) || 0);
        }
        return [0];
    };
    
    const sortedFiles = [...files].sort((a, b) => {
        const aVer = getVersionNum(a);
        const bVer = getVersionNum(b);
        for (let i = 0; i < Math.max(aVer.length, bVer.length); i++) {
            const aNum = aVer[i] || 0;
            const bNum = bVer[i] || 0;
            if (aNum !== bNum) return bNum - aNum;
        }
        return 0;
    });
    
    bodyContainer.innerHTML = `
        <style>
            @keyframes btnPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }
            .apr-emu-file-download-btn {
                background: linear-gradient(135deg, #ff8800, #cc5500);
                border: none;
                color: #fff;
                padding: 8px 18px;
                border-radius: 20px;
                font-weight: 800;
                font-size: 0.7rem;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            .apr-emu-file-download-btn:hover {
                background: linear-gradient(135deg, #ffaa00, #ff6600);
                box-shadow: 0 0 15px rgba(255, 136, 0, 0.5);
            }
            .apr-emu-file-download-btn:active {
                transform: scale(0.97);
            }
            .btn-shine {
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
                transition: left 0.5s ease;
                pointer-events: none;
            }
            .apr-emu-file-download-btn:hover .btn-shine {
                left: 100%;
            }
        </style>
        
        <div class="apr-emu-note" style="margin-bottom: 20px;">
            💡 <strong>How to use:</strong> Simply use OSFMount or exFAT Image Builder by Decker, mount the image and replace the .sprx inside the fakelib folder.
        </div>
        
        <div style="margin-bottom:15px;">
            ${sortedFiles.map(file => `
                <div class="apr-emu-file-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: rgba(255, 136, 0, 0.08); border-radius: 12px;">
                    <span class="apr-emu-file-name" style="font-size: 0.85rem;">📦 ${escapeHtml(file)}</span>
                    <button class="apr-emu-file-download-btn" data-file="${escapeHtml(file)}">
                        <span class="btn-shine"></span>
                        DOWNLOAD
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    
    // Aggiungi event listener per tutti i bottoni di download
    document.querySelectorAll('.apr-emu-file-download-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const fileName = this.getAttribute('data-file');
            const downloadUrl = `ampr-emu-drakmor/${fileName}`;
            
            const originalText = this.innerHTML;
            this.innerHTML = '⏳...';
            this.disabled = true;
            this.style.opacity = '0.7';
            
            try {
                const response = await fetch(downloadUrl);
                if (!response.ok) throw new Error('File not found');
                
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const fileNameOnly = fileName.split('/').pop();
                a.download = fileNameOnly;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                this.innerHTML = '✅';
                this.style.background = 'linear-gradient(135deg, #39ff14, #00cc00)';
                setTimeout(() => {
                    this.innerHTML = originalText;
                    this.disabled = false;
                    this.style.opacity = '1';
                    this.style.background = 'linear-gradient(135deg, #ff8800, #cc5500)';
                }, 1500);
            } catch (error) {
                console.error('Download error:', error);
                this.innerHTML = '❌';
                this.style.background = 'linear-gradient(135deg, #ff0033, #cc0000)';
                setTimeout(() => {
                    this.innerHTML = originalText;
                    this.disabled = false;
                    this.style.opacity = '1';
                    this.style.background = 'linear-gradient(135deg, #ff8800, #cc5500)';
                }, 1500);
            }
        });
    });
};

function closeAprEmuModal() {
    const modal = document.getElementById('aprEmuModal');
    if (!modal) return;
    
    modal.classList.add('hiding');
    const container = modal.querySelector('.apr-emu-modal-container');
    if (container) container.classList.add('closing');
    
    setTimeout(() => {
        modal.classList.remove('show', 'hiding');
        if (container) container.classList.remove('closing');
    }, 300);
}

function setupAprEmuModal() {
    const modal = document.getElementById('aprEmuModal');
    const closeBtn = document.getElementById('closeAprEmuModal');
    
    if (!modal) return;
    
    if (closeBtn) closeBtn.onclick = closeAprEmuModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeAprEmuModal(); });
}

// ========== DOWNLOAD FUNCTIONS ==========

function setupDownloadModal() {
    const modal = document.getElementById('download-modal');
    const closeBtn = document.getElementById('close-download-modal');
    const closeModal = () => { modal.classList.add('hiding'); const container = document.querySelector('#download-modal .download-modal-container'); if (container) container.classList.add('closing'); setTimeout(() => { modal.classList.remove('show', 'hiding'); if (container) container.classList.remove('closing'); }, 300); };
    if (closeBtn) closeBtn.onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

function showDownloadModal(content, downloadUrl) {
    const modal = document.getElementById('download-modal');
    const bodyContainer = document.getElementById('downloadModalBody');
    const finalBtn = document.getElementById('downloadFinalBtn');
    const pwHint = document.getElementById('downloadPwHint');
    const pwValue = document.getElementById('downloadPwValue');
    const passwordBox = document.getElementById('downloadPasswordBox');
    
    modal.classList.remove('hiding');
    const container = document.querySelector('#download-modal .download-modal-container');
    if (container) container.classList.remove('closing');
    
    if (passwordBox) passwordBox.style.display = 'block';
    if (finalBtn) finalBtn.style.display = 'block';
    if (pwHint) pwHint.style.display = 'block';
    if (pwValue) pwValue.style.display = 'none';
    
    const existingAprBtn = document.querySelector('#download-modal .apr-emu-download-btn-container');
    if (existingAprBtn) existingAprBtn.remove();
    
    if (bodyContainer) bodyContainer.innerHTML = content;
    if (finalBtn) finalBtn.href = downloadUrl;
    
    modal.classList.add('show');
}

function showAprEmuDownloadModal(content, downloadUrl) {
    const modal = document.getElementById('download-modal');
    const bodyContainer = document.getElementById('downloadModalBody');
    const passwordBox = document.getElementById('downloadPasswordBox');
    const finalBtn = document.getElementById('downloadFinalBtn');
    const pwHint = document.getElementById('downloadPwHint');
    const pwValue = document.getElementById('downloadPwValue');
    const footerDiv = document.querySelector('#download-modal .download-modal-container > div:last-child');
    
    modal.classList.remove('hiding');
    const container = document.querySelector('#download-modal .download-modal-container');
    if (container) container.classList.remove('closing');
    
    if (bodyContainer) bodyContainer.innerHTML = content;
    
    if (passwordBox) passwordBox.style.display = 'none';
    if (pwHint) pwHint.style.display = 'none';
    if (pwValue) pwValue.style.display = 'none';
    if (finalBtn) finalBtn.style.display = 'none';
    
    if (footerDiv) {
        footerDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <button onclick="openAprEmuModalFromDownload()" class="apr-emu-download-btn" style="background: linear-gradient(135deg, #ff8800, #cc5500); border: none; color: #fff; padding: 14px 20px; border-radius: 50px; font-weight: 800; font-size: 0.9rem; cursor: pointer; width: 100%; text-align: center; position: relative; overflow: hidden; display: inline-block;">
                    NEED APR-EMU UPDATE? CHECK HERE
                </button>
                <a href="${downloadUrl}" target="_blank" class="download-link-btn" style="background: linear-gradient(135deg, var(--cyan-neon), #0099cc); border: none; color: #000; padding: 14px 20px; border-radius: 50px; font-weight: 800; font-size: 0.9rem; cursor: pointer; width: 100%; text-align: center; text-decoration: none; display: inline-block; position: relative; overflow: hidden; box-sizing: border-box;">
                    DOWNLOAD
                </a>
            </div>
            <div style="font-size: 0.7rem; text-align: center; color: rgba(255,255,255,0.5); margin-top: 12px;">This game requires APR-EMU payload. Download it first before playing.</div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes shineAnimation {
                0% { transform: translateX(-100%); }
                20% { transform: translateX(100%); }
                100% { transform: translateX(100%); }
            }
            .shine-effect {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
                pointer-events: none;
                animation: shineAnimation 3s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);
        
        const aprEmuBtn = footerDiv.querySelector('.apr-emu-download-btn');
        const downloadLink = footerDiv.querySelector('.download-link-btn');
        
        if (aprEmuBtn) {
            const shine1 = document.createElement('span');
            shine1.className = 'shine-effect';
            aprEmuBtn.appendChild(shine1);
            aprEmuBtn.addEventListener('mouseenter', function() {
                this.style.background = 'linear-gradient(135deg, #ffaa00, #ff6600)';
                this.style.boxShadow = '0 0 20px rgba(255, 136, 0, 0.6)';
            });
            aprEmuBtn.addEventListener('mouseleave', function() {
                this.style.background = 'linear-gradient(135deg, #ff8800, #cc5500)';
                this.style.boxShadow = 'none';
            });
        }
        
        if (downloadLink) {
            const shine2 = document.createElement('span');
            shine2.className = 'shine-effect';
            downloadLink.appendChild(shine2);
            downloadLink.addEventListener('mouseenter', function() {
                this.style.background = 'linear-gradient(135deg, #00ffee, #00ccff)';
                this.style.boxShadow = '0 0 20px rgba(0, 255, 238, 0.7)';
            });
            downloadLink.addEventListener('mouseleave', function() {
                this.style.background = 'linear-gradient(135deg, var(--cyan-neon), #0099cc)';
                this.style.boxShadow = 'none';
            });
        }
    }
    
    modal.classList.add('show');
}

window.revealDownloadPassword = function() {
    const pwHint = document.getElementById('downloadPwHint');
    const pwValue = document.getElementById('downloadPwValue');
    if (pwHint) pwHint.style.display = 'none';
    if (pwValue) pwValue.style.display = 'block';
};

function openAprEmuModalFromDownload() {
    openAprEmuModal();
}

function startDownloadFromModal(url, fAuth, bAuth, dAuth, hPlay, isDLC, isDump, gameTitle, requireAprEmu) {
    openDL(url, fAuth, bAuth, dAuth, hPlay, isDLC, isDump, gameTitle);
}

function openDLWithAprEmuCheck(url, fAuth, bAuth, dAuth, hPlay, isDLC, isDump, gameTitle, requireAprEmu) {
    openDL(url, fAuth, bAuth, dAuth, hPlay, isDLC, isDump, gameTitle);
}

function openDL(url, fAuth, bAuth, dAuth, hPlay, isDLC = false, isDump = false, gameTitle) {
    let parts = [];
    const clean = (str) => (str && str !== "undefined" && str.trim() !== "") ? str.trim() : null;
    const fileAuthor = clean(fAuth), bpAuthor = clean(bAuth), dlcAuthor = clean(dAuth), playInstructions = clean(hPlay);
    
    if (fileAuthor && bpAuthor && fileAuthor === bpAuthor) {
        if (dlcAuthor) {
            parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with BackPort and <b>${escapeHtml(dlcAuthor)}</b> for DLCs`);
        } else {
            parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with BackPort`);
        }
    }
    else if (fileAuthor && dlcAuthor && fileAuthor === dlcAuthor) {
        parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with DLCs`);
        if (bpAuthor && bpAuthor !== fileAuthor) {
            parts.push(`<b>${escapeHtml(bpAuthor)}</b> for the BackPort`);
        }
    }
    else {
        if (fileAuthor) parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files`);
        if (dlcAuthor) parts.push(`<b>${escapeHtml(dlcAuthor)}</b> for DLCs`);
        if (bpAuthor) parts.push(`<b>${escapeHtml(bpAuthor)}</b> for the BackPort`);
    }
    
    let creditsText = parts.length > 0 ? "Thanks to " + parts.join(", ").replace(/, ([^,]*)$/, ' and $1') : "Thanks to the community.";
    let updateHTML = "";
    const updates = allUpdates[gameTitle];
    if (updates && updates.length > 0) {
        updateHTML = `<div class="download-updates-card"><div class="download-updates-title">🔄 OLD RELEASES</div>${updates.map(upd => { const dp = upd.date.split('-'); const formattedDate = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : upd.date; return `<div class="download-update-item"><div><div class="download-update-version">${escapeHtml(upd.version)}</div><div class="download-update-date">Released: ${formattedDate} (${upd.size || 'N/A'})</div></div><div class="download-update-links">${upd.akia_url ? `<a href="${upd.akia_url}" target="_blank" class="download-update-link">AKIA</a>` : ''}${upd.viki_url ? `<a href="${upd.viki_url}" target="_blank" class="download-update-link">VIKI</a>` : ''}${upd.buzz_url ? `<a href="${upd.buzz_url}" target="_blank" class="download-update-link">BUZZ</a>` : ''}${upd.data_url ? `<a href="${upd.data_url}" target="_blank" class="download-update-link">DATA</a>` : ''}</div></div>`; }).join('')}</div>`;
    }
    let instHTML = "";
    if (isDLC) instHTML = `<div class="download-instruction-card"><div class="download-instruction-title">🎮 HOW TO UNLOCK ALL DLCS</div><div class="download-instruction-text">Install the title (.exFAT) then the DLCs.${playInstructions ? `<br><br><strong>Extra Info:</strong> ${playInstructions}` : ''}</div></div>`;
    else if (playInstructions) instHTML = `<div class="download-instruction-card"><div class="download-instruction-title">📖 INSTRUCTIONS / HOW TO PLAY</div><div class="download-instruction-text">${playInstructions}</div></div>`;
    
    const modalContent = `<div class="download-credit-card"><div class="download-credit-text">${creditsText}</div></div>${instHTML}${updateHTML}`;
    
    const game = allGames.find(g => g.title === gameTitle);
    const requireAprEmu = game && (game.apr_emu === "on" || game.apr_emu === true || game.apr_emu === "true");
    
    if (requireAprEmu) {
        showAprEmuDownloadModal(modalContent, url);
    } else {
        showDownloadModal(modalContent, url);
    }
}

// ========== INIT ==========

async function init() {
    const isFlagged = sessionStorage.getItem('flagged_as_bot') === 'true' || IS_BOT;
    if (isFlagged) {
        const overlay = document.getElementById('site-lock-overlay');
        if (overlay) overlay.remove();
        const grid = document.getElementById('game-grid');
        if (grid) grid.innerHTML = `<div style="text-align:center; padding:60px; grid-column:1/-1;"><div style="font-size:3rem; margin-bottom:20px;">🔒</div><h2 style="color:var(--cyan-neon);">Access Restricted</h2><p style="color:rgba(255,255,255,0.6);">This content is temporarily unavailable. Please try again later.</p><p style="color:rgba(255,255,255,0.4); font-size:0.8rem; margin-top:20px;">Reference: ERR_${DEFENSE_TIMESTAMP}</p></div>`;
        const popular = document.getElementById('popular-section');
        if (popular) popular.style.display = 'none';
        const resultCounter = document.getElementById('result-counter');
        if (resultCounter) resultCounter.style.display = 'none';
        const pagination = document.querySelector('.pagination');
        if (pagination) pagination.style.display = 'none';
        return;
    }
    
    if (!checkIntegrity()) return;
    const unlocked = sessionStorage.getItem('unlocked');
    const unlockedTime = sessionStorage.getItem('unlocked_time');
    const overlay = document.getElementById('site-lock-overlay');
    let isUnlocked = false;
    if (unlocked === SECRET_HASH && unlockedTime) {
        const time = parseInt(unlockedTime);
        if (Date.now() - time <= 24 * 60 * 60 * 1000) isUnlocked = true;
        else { sessionStorage.removeItem('unlocked'); sessionStorage.removeItem('unlocked_time'); isUnlocked = false; }
    }
    
    showSkeletonLoader();
    showBackToTopButton();
    await loadUpdates();
    await loadLibrary();
    setupDropdown();
    setupMobileDropdown();
    setupMobileMenu();
    setupCarousel();
    setupSearchModal();
    setupHintCountdown();
    setupDownloadModal();
    setupDMCAModal();
    setupFAQModal();
    setupRandomGame();
    setupModalRandomButton();
    setupSortDropdown();
    setupToolDropdown();
    setupToolModal();
    setupPageJump();
    setupAprEmuModal();
    
    const navLogo = document.getElementById('navLogo');
    if (navLogo) navLogo.addEventListener('click', () => scrollToTop(true));
    
    if (isUnlocked) {
        if (overlay) overlay.remove();
        document.body.style.overflow = 'auto';
        startIntegrityCheck();
        startProtection();
    } else {
        document.body.style.overflow = 'hidden';
        startProtection();
    }
}

// ========== REST OF FUNCTIONS ==========

let gameTitlePlaceholder = '';
let fileAuthPlaceholder = '';
let bpAuthPlaceholder = '';
let dlcAuthPlaceholder = '';
let hPlayPlaceholder = '';

function updateModalContentWithRipple(game) {
    if (isTransitioning) return;
    isTransitioning = true;
    gameTitlePlaceholder = game.title.replace(/'/g, "\\'");
    fileAuthPlaceholder = game.credits_files || '';
    bpAuthPlaceholder = game.credits_backport || '';
    dlcAuthPlaceholder = game.credits_dlc || game.credits_dlcs || '';
    hPlayPlaceholder = (game.how_to_play || "").replace(/'/g, "\\'");
    const modalHeader = document.getElementById('modal-header');
    const modalBody = document.getElementById('modal-body');
    const modalTitle = document.getElementById('modal-title');
    const modalTags = document.getElementById('modal-tags');
    const modalSize = document.getElementById('modal-size');
    const downloadsContainer = document.getElementById('modal-downloads');
    const creditsContainer = document.getElementById('modal-credits');
    const instSection = document.getElementById('modal-instructions');
    const instText = document.getElementById('modal-instructions-text');
    const updatesSection = document.getElementById('modal-updates');
    const updatesList = document.getElementById('modal-updates-list');
    const dlcSection = document.getElementById('modal-dlc-section');
    const dlcContainer = document.getElementById('modal-dlc');
    const dumpSection = document.getElementById('modal-dump-section');
    const dumpContainer = document.getElementById('modal-dump');
    
    modalHeader.classList.add('modal-header-ripple-out');
    modalBody.classList.add('modal-body-ripple-out');
    
    setTimeout(() => {
        modalHeader.style.backgroundImage = `url('${game.image}')`;
        modalHeader.style.backgroundSize = 'cover';
        modalHeader.style.backgroundPosition = 'center';
        modalTitle.textContent = game.title;
        modalTags.innerHTML = (game.tags || []).map(t => `<span class="modal-tag">${escapeHtml(t)}</span>`).join('');
        modalSize.textContent = game.size || 'N/A';

        const aprEmuBadge = document.getElementById('modal-apr-emu-badge');
        const requireAprEmu = (game.apr_emu === "on" || game.apr_emu === true || game.apr_emu === "true");
        if (requireAprEmu) {
            aprEmuBadge.innerHTML = '<div class="modal-apr-emu">APR-EMU</div><button class="apr-emu-update-btn" onclick="openAprEmuModal()">⚠️ Need APR-EMU update? Check here</button>';
            aprEmuBadge.style.display = 'block';
        } else {
            aprEmuBadge.innerHTML = '';
            aprEmuBadge.style.display = 'none';
        }
        
        const createModalBtnLocal = (url, label, isDump = false) => {
            if (!url || url === "undefined" || url.trim() === "") return '';
            const dumpAttr = isDump ? 'true' : 'false';
            return `<button onclick="startDownloadFromModal('${url}', '${fileAuthPlaceholder}', '${bpAuthPlaceholder}', '${dlcAuthPlaceholder}', '${hPlayPlaceholder}', false, ${dumpAttr}, '${game.title.replace(/'/g, "\\'")}', ${requireAprEmu})" class="modal-btn">${label}</button>`;
        };
        
        let downloadsHTML = '';
        const hasBackport7 = game.backport7xx_akia || game.backport7xx_viki || game.backport7xx_buzz || game.backport7xx_data;
        const hasBackport4 = game.backport4xx_akia || game.backport4xx_viki || game.backport4xx_buzz || game.backport4xx_data;
        if (hasBackport7 || hasBackport4) {
            let bp7 = '', bp4 = '';
            if (hasBackport7) {
                if (game.backport7xx_akia) bp7 += createModalBtnLocal(game.backport7xx_akia, 'AKIA');
                if (game.backport7xx_viki) bp7 += createModalBtnLocal(game.backport7xx_viki, 'VIKI');
                if (game.backport7xx_buzz) bp7 += createModalBtnLocal(game.backport7xx_buzz, 'BUZZ');
                if (game.backport7xx_data) bp7 += createModalBtnLocal(game.backport7xx_data, 'DATA');
            }
            if (hasBackport4) {
                if (game.backport4xx_akia) bp4 += createModalBtnLocal(game.backport4xx_akia, 'AKIA');
                if (game.backport4xx_viki) bp4 += createModalBtnLocal(game.backport4xx_viki, 'VIKI');
                if (game.backport4xx_buzz) bp4 += createModalBtnLocal(game.backport4xx_buzz, 'BUZZ');
                if (game.backport4xx_data) bp4 += createModalBtnLocal(game.backport4xx_data, 'DATA');
            }
            downloadsHTML = `${bp7 ? `<div style="width:100%; margin-bottom:10px;"><strong>Backport 7.xx</strong></div>${bp7}` : ''}${bp4 ? `<div style="width:100%; margin-bottom:10px; margin-top:10px;"><strong>Backport 4.xx</strong></div>${bp4}` : ''}`;
        } else if (game.standard_akia || game.standard_viki || game.standard_buzz || game.standard_data || game.backport_akia || game.backport_viki || game.backport_buzz || game.backport_data) {
            let std = '', bp = '';
            if (game.standard_akia) std += createModalBtnLocal(game.standard_akia, 'AKIA');
            if (game.standard_viki) std += createModalBtnLocal(game.standard_viki, 'VIKI');
            if (game.standard_buzz) std += createModalBtnLocal(game.standard_buzz, 'BUZZ');
            if (game.standard_data) std += createModalBtnLocal(game.standard_data, 'DATA');
            if (game.backport_akia) bp += createModalBtnLocal(game.backport_akia, 'AKIA');
            if (game.backport_viki) bp += createModalBtnLocal(game.backport_viki, 'VIKI');
            if (game.backport_buzz) bp += createModalBtnLocal(game.backport_buzz, 'BUZZ');
            if (game.backport_data) bp += createModalBtnLocal(game.backport_data, 'DATA');
            downloadsHTML = `${std ? `<div style="width:100%; margin-bottom:10px;"><strong>STANDARD</strong></div>${std}` : ''}${bp ? `<div style="width:100%; margin-bottom:10px; margin-top:10px;"><strong>BACKPORT</strong></div>${bp}` : ''}`;
        } else {
            let btns = '';
            if (game.akia_url) btns += createModalBtnLocal(game.akia_url, 'AKIA');
            if (game.viki_url) btns += createModalBtnLocal(game.viki_url, 'VIKI');
            if (game.buzz_url) btns += createModalBtnLocal(game.buzz_url, 'BUZZ');
            if (game.data_url) btns += createModalBtnLocal(game.data_url, 'DATA');
            downloadsHTML = btns;
        }
        downloadsContainer.innerHTML = downloadsHTML;
        
        let dumpHTML = '';
        const hasDump = game.dump_akia || game.dump_viki || game.dump_buzz || game.dump_data;
        if (hasDump) {
            if (game.dump_akia) dumpHTML += createModalBtnLocal(game.dump_akia, 'AKIA', true);
            if (game.dump_viki) dumpHTML += createModalBtnLocal(game.dump_viki, 'VIKI', true);
            if (game.dump_buzz) dumpHTML += createModalBtnLocal(game.dump_buzz, 'BUZZ', true);
            if (game.dump_data) dumpHTML += createModalBtnLocal(game.dump_data, 'DATA', true);
            dumpSection.style.display = 'block';
            dumpContainer.innerHTML = dumpHTML;
        } else dumpSection.style.display = 'none';
        
        let dlcBtns = '';
        if (game.dlc_akia) dlcBtns += createModalBtnLocal(game.dlc_akia, 'AKIA');
        if (game.dlc_viki) dlcBtns += createModalBtnLocal(game.dlc_viki, 'VIKI');
        if (game.dlc_buzz) dlcBtns += createModalBtnLocal(game.dlc_buzz, 'BUZZ');
        if (game.dlc_data) dlcBtns += createModalBtnLocal(game.dlc_data, 'DATA');
        if (dlcBtns) { dlcSection.style.display = 'block'; dlcContainer.innerHTML = dlcBtns; } else dlcSection.style.display = 'none';
        
        let parts = [];
        const fileAuthor = game.credits_files, bpAuthor = game.credits_backport, dlcAuthor = game.credits_dlc || game.credits_dlcs;
        
        if (fileAuthor && bpAuthor && fileAuthor === bpAuthor) {
            if (dlcAuthor) {
                parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with BackPort and <b>${escapeHtml(dlcAuthor)}</b> for DLCs`);
            } else {
                parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with BackPort`);
            }
        }
        else if (fileAuthor && dlcAuthor && fileAuthor === dlcAuthor) {
            parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with DLCs`);
            if (bpAuthor && bpAuthor !== fileAuthor) {
                parts.push(`<b>${escapeHtml(bpAuthor)}</b> for the BackPort`);
            }
        }
        else {
            if (fileAuthor) parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files`);
            if (dlcAuthor) parts.push(`<b>${escapeHtml(dlcAuthor)}</b> for DLCs`);
            if (bpAuthor) parts.push(`<b>${escapeHtml(bpAuthor)}</b> for the BackPort`);
        }
        
        let creditsText = parts.length > 0 ? "Thanks to " + parts.join(", ").replace(/, ([^,]*)$/, ' and $1') : "Thanks to the community.";
        creditsContainer.innerHTML = creditsText;
        
        if (game.how_to_play) { instSection.style.display = 'block'; instText.innerHTML = game.how_to_play; } else instSection.style.display = 'none';
        
        const updates = allUpdates[game.title];
        if (updates && updates.length > 0) {
            updatesSection.style.display = 'block';
            updatesList.innerHTML = updates.map(upd => { const dp = upd.date.split('-'); const formattedDate = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : upd.date; return `<div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:8px;"><div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;"><div><strong>${escapeHtml(upd.version)}</strong> <small style="opacity:0.6;">(${upd.size || 'N/A'})</small><br><small style="color:var(--cyan-neon);">Released: ${formattedDate}</small></div><div style="display:flex; gap:8px;">${upd.akia_url ? `<a href="${upd.akia_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">AKIA</a>` : ''}${upd.viki_url ? `<a href="${upd.viki_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">VIKI</a>` : ''}${upd.buzz_url ? `<a href="${upd.buzz_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">BUZZ</a>` : ''}${upd.data_url ? `<a href="${upd.data_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">DATA</a>` : ''}</div></div></div>`; }).join('');
        } else updatesSection.style.display = 'none';
        
        modalHeader.classList.remove('modal-header-ripple-out');
        modalBody.classList.remove('modal-body-ripple-out');
        modalHeader.classList.add('modal-header-ripple-in');
        modalBody.classList.add('modal-body-ripple-in');
        setTimeout(() => {
            modalHeader.classList.remove('modal-header-ripple-in');
            modalBody.classList.remove('modal-body-ripple-in');
            isTransitioning = false;
        }, 350);
    }, 250);
}

function setupMobileMenu() {
    const hamburger = document.getElementById('hamburgerBtn');
    const panel = document.getElementById('mobileMenuPanel');
    const overlay = document.getElementById('mobileMenuOverlay');
    const searchBtn = document.querySelector('.mobile-menu-item[data-action="search"]');
    const randomBtn = document.querySelector('.mobile-menu-item[data-action="random"]');
    const toolBtn = document.querySelector('.mobile-menu-item[data-action="tool"]');
    function closeMenu() { if (hamburger) hamburger.classList.remove('active'); if (panel) panel.classList.remove('open'); if (overlay) overlay.classList.remove('active'); document.body.classList.remove('menu-open'); }
    function openMenu() { if (hamburger) hamburger.classList.add('active'); if (panel) panel.classList.add('open'); if (overlay) overlay.classList.add('active'); document.body.classList.add('menu-open'); }
    if (hamburger) hamburger.addEventListener('click', (e) => { e.stopPropagation(); if (panel && panel.classList.contains('open')) closeMenu(); else openMenu(); });
    if (overlay) overlay.addEventListener('click', closeMenu);
    if (searchBtn) searchBtn.addEventListener('click', () => { closeMenu(); const searchOverlay = document.getElementById('searchModalOverlay'); if (searchOverlay) { searchOverlay.classList.add('active'); const searchInput = document.getElementById('searchModalInput'); setTimeout(() => { if (searchInput) { searchInput.focus(); searchInput.select(); } }, 100); } });
    if (randomBtn) randomBtn.addEventListener('click', () => { closeMenu(); if (!allGames.length) return; const selectedFW = parseInt(document.getElementById('fw-filter').value, 10); let availableGames = allGames; if (selectedFW !== 99) availableGames = allGames.filter(g => { let gameFW = 1; if (g.tags && g.tags.length > 0) { let foundVersions = []; g.tags.forEach(tag => { const matches = tag.match(/(\d+)\.xx/gi); if (matches) matches.forEach(m => { const num = parseInt(m.match(/\d+/)[0], 10); foundVersions.push(num); }); }); if (foundVersions.length > 0) gameFW = Math.min(...foundVersions); } return gameFW <= selectedFW; }); if (availableGames.length === 0) return; const randomIndex = Math.floor(Math.random() * availableGames.length); const randomGame = availableGames[randomIndex]; isRandomModeActive = true; openGameModal(randomGame, null); });
    if (toolBtn) toolBtn.addEventListener('click', () => { closeMenu(); openToolModal('pegasus'); });
}

function setupMobileDropdown() {
    const mobileDropdown = document.getElementById('mobile-fw-dropdown');
    if (!mobileDropdown) return;
    const trigger = mobileDropdown.querySelector('.dropdown-trigger');
    const optionsContainer = document.getElementById('mobile-fw-options');
    const currentText = document.getElementById('mobile-fw-current');
    const hiddenInput = document.getElementById('mobile-fw-filter');
    const desktopHiddenInput = document.getElementById('fw-filter');
    const desktopCurrentText = document.getElementById('fw-current');
    const allOptions = mobileDropdown.querySelectorAll('.option');
    trigger.onclick = (e) => { e.stopPropagation(); optionsContainer.classList.toggle('show'); mobileDropdown.classList.toggle('active'); };
    allOptions.forEach(opt => {
        opt.onclick = () => {
            const val = opt.getAttribute('data-value');
            const label = opt.innerText;
            currentText.innerText = label;
            hiddenInput.value = val;
            if (desktopHiddenInput) desktopHiddenInput.value = val;
            if (desktopCurrentText) desktopCurrentText.innerText = label;
            optionsContainer.classList.remove('show');
            mobileDropdown.classList.remove('active');
            const searchInput = document.getElementById('searchModalInput');
            if (searchInput && searchInput.value.trim()) { updateSearchResultsExternal(searchInput.value); performSearchOnGridExternal(searchInput.value); }
            else { applyFWFilterWithSort(); currentPage = 1; renderGames(); updateResultCount(); }
        };
    });
    window.addEventListener('click', () => { optionsContainer.classList.remove('show'); mobileDropdown.classList.remove('active'); });
}

function setupModalRandomButton() {
    const modalRandomBtn = document.getElementById('modalRandomBtn');
    if (!modalRandomBtn) return;
    modalRandomBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!allGames.length || isTransitioning) return;
        const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
        let availableGames = allGames;
        if (selectedFW !== 99) availableGames = allGames.filter(g => { let gameFW = 1; if (g.tags && g.tags.length > 0) { let foundVersions = []; g.tags.forEach(tag => { const matches = tag.match(/(\d+)\.xx/gi); if (matches) matches.forEach(m => { const num = parseInt(m.match(/\d+/)[0], 10); foundVersions.push(num); }); }); if (foundVersions.length > 0) gameFW = Math.min(...foundVersions); } return gameFW <= selectedFW; });
        if (availableGames.length === 0) return;
        const randomIndex = Math.floor(Math.random() * availableGames.length);
        const randomGame = availableGames[randomIndex];
        isRandomModeActive = true;
        updateModalContentWithRipple(randomGame);
        const btn = modalRandomBtn;
        btn.style.transform = 'scale(0.98)';
        setTimeout(() => { btn.style.transform = ''; }, 150);
    });
}

function setupRandomGame() {
    const randomBtn = document.getElementById('navRandomBtn');
    if (!randomBtn) return;
    randomBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!allGames.length) return;
        const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
        let availableGames = allGames;
        if (selectedFW !== 99) availableGames = allGames.filter(g => { let gameFW = 1; if (g.tags && g.tags.length > 0) { let foundVersions = []; g.tags.forEach(tag => { const matches = tag.match(/(\d+)\.xx/gi); if (matches) matches.forEach(m => { const num = parseInt(m.match(/\d+/)[0], 10); foundVersions.push(num); }); }); if (foundVersions.length > 0) gameFW = Math.min(...foundVersions); } return gameFW <= selectedFW; });
        if (availableGames.length === 0) return;
        const randomIndex = Math.floor(Math.random() * availableGames.length);
        const randomGame = availableGames[randomIndex];
        isRandomModeActive = true;
        openGameModal(randomGame, null);
        const img = randomBtn.querySelector('img');
        if (img) { img.style.transform = 'scale(0.9)'; setTimeout(() => { img.style.transform = ''; }, 150); }
    });
}

function setupDMCAModal() {
    const modal = document.getElementById('dmca-modal');
    const closeBtn = document.getElementById('close-dmca-modal');
    const dmcaLink = document.getElementById('dmca-link');
    const mobileDmcaBtn = document.querySelector('.mobile-menu-item.dmca');
    const closeModal = () => { modal.classList.add('hiding'); const container = document.querySelector('#dmca-modal .dmca-modal-container'); if (container) container.classList.add('closing'); setTimeout(() => { modal.classList.remove('show', 'hiding'); if (container) container.classList.remove('closing'); }, 300); };
    if (closeBtn) closeBtn.onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    const openDMCAModal = async () => {
        try {
            const res = await fetch('DMCA.json');
            const data = await res.json();
            const bodyContainer = document.getElementById('dmcaModalBody');
            if (bodyContainer) bodyContainer.innerHTML = `<div class="dmca-text">${data.content.map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>`;
            modal.classList.remove('hiding'); const container = document.querySelector('#dmca-modal .dmca-modal-container'); if (container) container.classList.remove('closing'); modal.classList.add('show');
        } catch(err) { console.error(err); const bodyContainer = document.getElementById('dmcaModalBody'); if (bodyContainer) bodyContainer.innerHTML = '<div class="dmca-text"><p>Errore nel caricamento del contenuto DMCA.</p></div>'; modal.classList.add('show'); }
    };
    if (dmcaLink) dmcaLink.onclick = openDMCAModal;
    if (mobileDmcaBtn) { const newMobileBtn = mobileDmcaBtn.cloneNode(true); mobileDmcaBtn.parentNode.replaceChild(newMobileBtn, mobileDmcaBtn); newMobileBtn.addEventListener('click', (e) => { e.preventDefault(); const panel = document.getElementById('mobileMenuPanel'); const overlay = document.getElementById('mobileMenuOverlay'); const hamburger = document.getElementById('hamburgerBtn'); if (panel) panel.classList.remove('open'); if (overlay) overlay.classList.remove('active'); if (hamburger) hamburger.classList.remove('active'); openDMCAModal(); }); }
}

function setupFAQModal() {
    const modal = document.getElementById('faq-modal');
    const closeBtn = document.getElementById('close-faq-modal');
    const faqLink = document.getElementById('faq-link');
    
    const closeModal = () => {
        if (!modal) return;
        modal.classList.add('hiding');
        const container = modal.querySelector('.faq-modal-container');
        if (container) container.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('show', 'hiding');
            if (container) container.classList.remove('closing');
        }, 300);
    };
    
    if (closeBtn) closeBtn.onclick = closeModal;
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    const openFAQModal = async () => {
        try {
            const res = await fetch('FAQ.json?v=' + Date.now());
            const data = await res.json();
            const bodyContainer = document.getElementById('faqModalBody');
            if (bodyContainer) {
                let html = `<div class="faq-text"><h3 style="color:var(--cyan-neon); margin-bottom:25px; text-align:center;">${data.title}</h3>`;
                data.sections.forEach(section => {
                    html += `<div class="faq-question">
                                <strong>${escapeHtml(section.question)}</strong>
                                <p>${escapeHtml(section.answer)}</p>
                             </div>`;
                });
                html += `</div>`;
                bodyContainer.innerHTML = html;
            }
            if (modal) {
                modal.classList.remove('hiding');
                const container = modal.querySelector('.faq-modal-container');
                if (container) container.classList.remove('closing');
                modal.classList.add('show');
            }
        } catch(err) {
            console.error("Errore caricamento FAQ:", err);
            const bodyContainer = document.getElementById('faqModalBody');
            if (bodyContainer) bodyContainer.innerHTML = '<div class="faq-text"><p>⚠️ Impossibile caricare le FAQ. Riprova più tardi.</p></div>';
            if (modal) modal.classList.add('show');
        }
    };
    
    if (faqLink) faqLink.onclick = openFAQModal;
    
    let faqMobileItem = document.querySelector('.mobile-menu-item.faq-mobile');
    if (!faqMobileItem) {
        const mobileMenuPanel = document.getElementById('mobileMenuPanel');
        const dmcaItem = document.querySelector('.mobile-menu-item.dmca');
        if (mobileMenuPanel && dmcaItem) {
            faqMobileItem = document.createElement('div');
            faqMobileItem.className = 'mobile-menu-item faq-mobile';
            faqMobileItem.textContent = '❓ FAQ';
            faqMobileItem.style.cursor = 'pointer';
            dmcaItem.parentNode.insertBefore(faqMobileItem, dmcaItem);
        }
    }
    
    if (faqMobileItem) {
        const newFaqMobile = faqMobileItem.cloneNode(true);
        faqMobileItem.parentNode.replaceChild(newFaqMobile, faqMobileItem);
        newFaqMobile.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const panel = document.getElementById('mobileMenuPanel');
            const overlay = document.getElementById('mobileMenuOverlay');
            const hamburger = document.getElementById('hamburgerBtn');
            if (panel) panel.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
            if (hamburger) hamburger.classList.remove('active');
            openFAQModal();
        });
    }
}

function setupSearchModal() {
    const overlay = document.getElementById('searchModalOverlay');
    const searchInput = document.getElementById('searchModalInput');
    const closeBtn = document.getElementById('searchModalCloseBtn');
    const statsSpan = document.getElementById('searchModalStats');
    const resultsContainer = document.getElementById('searchResultsContainer');
    const navBtn = document.getElementById('navSearchBtn');
    if (!overlay || !searchInput) return;
    const openSearch = () => { overlay.classList.add('active'); searchInput.value = ''; updateSearchResults(''); setTimeout(() => { searchInput.focus(); searchInput.select(); }, 50); };
    const closeSearch = () => { overlay.classList.remove('active'); searchInput.value = ''; updateSearchResults(''); applyFWFilterWithSort(); currentPage = 1; renderGames(); updateResultCount(); searchInput.blur(); };
    if (navBtn) navBtn.addEventListener('click', openSearch);
    if (closeBtn) closeBtn.addEventListener('click', closeSearch);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSearch(); });
    document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); openSearch(); } if (e.key === 'Escape' && overlay.classList.contains('active')) { e.preventDefault(); closeSearch(); } if (e.key === 'Escape' && document.getElementById('game-detail-modal').style.display === 'block') { document.getElementById('game-detail-modal').style.display = 'none'; isRandomModeActive = false; } });
    searchInput.addEventListener('input', (e) => { if (searchTimeout) clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { const term = e.target.value; updateSearchResults(term); performSearchOnGrid(term); }, 200); });
    searchInput.addEventListener('focus', () => { searchInput.style.animation = 'searchGlow 0.4s ease'; setTimeout(() => { if(searchInput) searchInput.style.animation = ''; }, 400); });
    
    function updateSearchResults(term) {
        const lowerTerm = term.toLowerCase().trim();
        const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
        if (!lowerTerm) { resultsContainer.innerHTML = '<div class="no-results">Start typing to search for games...</div>'; statsSpan.textContent = '0'; return; }
        const searchResults = allGames.filter(g => { const matchesSearch = g.title.toLowerCase().includes(lowerTerm); let gameFW = 1; if (g.tags && g.tags.length > 0) { let foundVersions = []; g.tags.forEach(tag => { const matches = tag.match(/(\d+)\.xx/gi); if (matches) matches.forEach(m => { const num = parseInt(m.match(/\d+/)[0], 10); foundVersions.push(num); }); }); if (foundVersions.length > 0) gameFW = Math.min(...foundVersions); } return matchesSearch && gameFW <= selectedFW; });
        statsSpan.textContent = searchResults.length;
        statsSpan.style.animation = 'none'; statsSpan.offsetHeight; statsSpan.style.animation = 'fadeIn 0.2s ease';
        if (searchResults.length === 0) { resultsContainer.innerHTML = '<div class="no-results">😔 Nessun gioco trovato per "' + escapeHtml(lowerTerm) + '"</div>'; return; }
        resultsContainer.innerHTML = searchResults.map(game => `<div class="search-result-item" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'><img class="search-result-img" src="${game.image}" alt="${game.title}" loading="lazy" referrerpolicy="no-referrer"><div class="search-result-info"><div class="search-result-title">${escapeHtml(game.title)}</div><div class="search-result-tags">${(game.tags || []).slice(0, 3).map(t => `<span class="search-result-tag">${escapeHtml(t)}</span>`).join('')}${(game.tags || []).length > 3 ? `<span class="search-result-tag">+${game.tags.length - 3}</span>` : ''}</div></div>${game.size ? `<div class="search-result-size">${game.size}</div>` : ''}</div>`).join('');
        document.querySelectorAll('.search-result-item').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); const gameDataAttr = el.getAttribute('data-game'); if (gameDataAttr) { try { const decoded = gameDataAttr.replace(/&quot;/g, '"').replace(/&#39;/g, "'"); const game = JSON.parse(decoded); closeSearch(); setTimeout(() => { isRandomModeActive = false; openGameModal(game, e); }, 300); } catch(err) { console.error("Errore:", err); } } }); });
    }
    
    function performSearchOnGrid(term) {
        const lowerTerm = term.toLowerCase().trim();
        const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
        const sortValue = document.getElementById('sort-filter').value;
        if (!lowerTerm) { applyFWFilterWithSort(); currentPage = 1; renderGames(); updateResultCount(); scrollToTop(true); return; }
        const searchResults = allGames.filter(g => { const matchesSearch = g.title.toLowerCase().includes(lowerTerm); let gameFW = 1; if (g.tags && g.tags.length > 0) { let foundVersions = []; g.tags.forEach(tag => { const matches = tag.match(/(\d+)\.xx/gi); if (matches) matches.forEach(m => { const num = parseInt(m.match(/\d+/)[0], 10); foundVersions.push(num); }); }); if (foundVersions.length > 0) gameFW = Math.min(...foundVersions); } return matchesSearch && gameFW <= selectedFW; });
        filteredGames = sortGames(searchResults, sortValue);
        currentPage = 1; renderGames(); updateResultCount(); scrollToTop(true);
    }
}

async function loadUpdates() {
    try {
        const response = await fetch('old_updates.json?v=' + Date.now());
        if (response.ok) allUpdates = await response.json();
    } catch (e) { console.warn("Updates file non trovato."); }
}

async function loadLibrary() {
    try {
        const isFlagged = sessionStorage.getItem('flagged_as_bot') === 'true' || IS_BOT;
        const response = await fetch('exFAT.json?v=' + Date.now());
        if (!response.ok) throw new Error("Errore JSON Network");
        const text = await response.text();
        try {
            let data = JSON.parse(text);
            if (isFlagged) data = generateFakeGames(500);
            allGames = data;
            allGames.forEach((game, index) => { originalOrderMap.set(game.title, index); });
        } catch (jsonError) { alert("🚨 ERRORE FATALE: Il tuo file exFAT.json è rotto!\nCorreggi il file JSON e ricarica la pagina."); hideSkeletonLoader(); return; }
        document.getElementById('fw-filter').value = '99';
        document.getElementById('fw-current').innerText = 'FW: All';
        const mobileFwFilter = document.getElementById('mobile-fw-filter');
        const mobileFwCurrent = document.getElementById('mobile-fw-current');
        if (mobileFwFilter) mobileFwFilter.value = '99';
        if (mobileFwCurrent) mobileFwCurrent.innerText = 'FW: All';
        document.getElementById('sort-filter').value = 'default';
        document.getElementById('sort-current').innerText = 'Sort: Default';
        const mobileSortFilter = document.getElementById('mobile-sort-filter');
        const mobileSortCurrent = document.getElementById('mobile-sort-current');
        if (mobileSortFilter) mobileSortFilter.value = 'default';
        if (mobileSortCurrent) mobileSortCurrent.innerText = 'Sort: Default';
        localStorage.removeItem('preferred_fw');
        localStorage.removeItem('preferred_sort');
        applyFWFilterWithSort();
        renderPopularGames();
        renderGames();
        updateResultCount();
        hideSkeletonLoader();
    } catch (e) { console.error("Errore caricamento library:", e); hideSkeletonLoader(); }
}

function setupCarousel() {
    const container = document.getElementById('carousel-container');
    const track = document.getElementById('popular-track');
    if (!container || !track) return;
    const halfWidth = track.scrollWidth / 2;
    let startTime = null;
    let autoScrollActive = true;
    let startDragX = 0, startDragPos = 0;
    function autoScrollAnimation(timestamp) {
        if (!autoScrollActive || isDragging) { animationId = requestAnimationFrame(autoScrollAnimation); return; }
        if (!startTime) startTime = timestamp;
        const speed = 0.25;
        currentPosition = (currentPosition + speed) % halfWidth;
        track.style.transform = `translateX(-${currentPosition}px)`;
        animationId = requestAnimationFrame(autoScrollAnimation);
    }
    const startDrag = (e) => { if (e.button === 2 || e.type === 'contextmenu') return; e.preventDefault(); hasMoved = false; window._wasDrag = false; if (autoScrollActive) autoScrollActive = false; isDragging = true; startDragX = e.type === 'mousedown' ? e.pageX : e.touches[0].pageX; startDragPos = currentPosition; track.style.transition = 'none'; container.style.cursor = 'grabbing'; };
    const onDrag = (e) => { if (!isDragging) return; e.preventDefault(); const currentX = e.type === 'mousemove' ? e.pageX : e.touches[0].pageX; const diff = currentX - startDragX; if (Math.abs(diff) > 5) { hasMoved = true; window._wasDrag = true; } let newPosition = startDragPos - diff; const halfTrack = track.scrollWidth / 2; if (newPosition >= halfTrack) { newPosition -= halfTrack; startDragPos -= halfTrack; } else if (newPosition < 0) { newPosition += halfTrack; startDragPos += halfTrack; } currentPosition = newPosition; track.style.transform = `translateX(-${currentPosition}px)`; };
    const endDrag = () => { if (!isDragging) return; isDragging = false; track.style.transition = ''; container.style.cursor = 'grab'; setTimeout(() => { if (!isDragging) { autoScrollActive = true; startTime = null; window._wasDrag = false; } }, 2000); };
    container.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });
    container.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
    container.addEventListener('touchstart', startDrag);
    window.addEventListener('touchmove', onDrag, { passive: false });
    window.addEventListener('touchend', endDrag);
    container.addEventListener('mouseenter', () => { autoScrollActive = false; });
    container.addEventListener('mouseleave', () => { if (!isDragging) { autoScrollActive = true; startTime = null; } });
    animationId = requestAnimationFrame(autoScrollAnimation);
}

async function hashStr(str) {
    if (!crypto || !crypto.subtle) { alert("⚠️ ERRORE BROWSER: Per testare la password devi caricare i file su GitHub Pages!"); return null; }
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkSitePassword() {
    try {
        const input = document.getElementById('site-pw-input').value;
        const overlay = document.getElementById('site-lock-overlay');
        const errorMsg = document.getElementById('pw-error');
        const lockBox = document.getElementById('lock-box');
        const hashedInput = await hashStr(input);
        if (!hashedInput) return;
        if (hashedInput === SECRET_HASH) {
            sessionStorage.setItem('unlocked', SECRET_HASH);
            sessionStorage.setItem('unlocked_time', Date.now().toString());
            if (overlay) { overlay.style.transition = 'opacity 0.5s ease'; overlay.style.opacity = '0'; setTimeout(() => { if (overlay && overlay.parentNode) overlay.remove(); document.body.style.overflow = 'auto'; startIntegrityCheck(); }, 500); }
        } else { errorMsg.style.display = 'block'; lockBox.style.animation = 'none'; lockBox.offsetHeight; lockBox.style.animation = 'shake 0.3s ease-in-out'; document.getElementById('site-pw-input').value = ''; setTimeout(() => { if (errorMsg) errorMsg.style.display = 'none'; }, 2000); }
    } catch (e) { console.error("Errore password:", e); }
}

function startProtection() {
    if (protectionInterval) clearInterval(protectionInterval);
    protectionInterval = setInterval(() => {
        const unlocked = sessionStorage.getItem('unlocked');
        const unlockedTime = sessionStorage.getItem('unlocked_time');
        const overlay = document.getElementById('site-lock-overlay');
        if (!overlay && unlocked !== SECRET_HASH) location.reload();
        if (unlocked === SECRET_HASH && unlockedTime) { const time = parseInt(unlockedTime); if (Date.now() - time > 24 * 60 * 60 * 1000) { sessionStorage.removeItem('unlocked'); sessionStorage.removeItem('unlocked_time'); location.reload(); } }
        if (overlay && unlocked === SECRET_HASH) { overlay.remove(); document.body.style.overflow = 'auto'; }
    }, 5000);
}

function setupDropdown() {
    const dropdown = document.getElementById('fw-dropdown');
    if (!dropdown) return;
    const trigger = dropdown.querySelector('.dropdown-trigger');
    const optionsContainer = document.getElementById('fw-options');
    const currentText = document.getElementById('fw-current');
    const hiddenInput = document.getElementById('fw-filter');
    const allOptions = dropdown.querySelectorAll('.option');
    trigger.onclick = (e) => { e.stopPropagation(); optionsContainer.classList.toggle('show'); dropdown.classList.toggle('active'); };
    allOptions.forEach(opt => {
        opt.onclick = () => {
            const val = opt.getAttribute('data-value');
            currentText.innerText = opt.innerText;
            hiddenInput.value = val;
            optionsContainer.classList.remove('show');
            dropdown.classList.remove('active');
            const mobileHiddenInput = document.getElementById('mobile-fw-filter');
            const mobileCurrentText = document.getElementById('mobile-fw-current');
            if (mobileHiddenInput) mobileHiddenInput.value = val;
            if (mobileCurrentText) mobileCurrentText.innerText = opt.innerText;
            const searchInput = document.getElementById('searchModalInput');
            if (searchInput && searchInput.value.trim()) { updateSearchResultsExternal(searchInput.value); performSearchOnGridExternal(searchInput.value); }
            else { applyFWFilterWithSort(); currentPage = 1; renderGames(); updateResultCount(); }
        };
    });
    window.addEventListener('click', () => { optionsContainer.classList.remove('show'); dropdown.classList.remove('active'); });
}

function updateSearchResultsExternal(term) {
    const resultsContainer = document.getElementById('searchResultsContainer');
    const statsSpan = document.getElementById('searchModalStats');
    const lowerTerm = term.toLowerCase().trim();
    const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
    if (!lowerTerm) { if (resultsContainer) resultsContainer.innerHTML = '<div class="no-results">✨ Inizia a digitare per cercare giochi...</div>'; if (statsSpan) statsSpan.textContent = '0'; return; }
    const searchResults = allGames.filter(g => { const matchesSearch = g.title.toLowerCase().includes(lowerTerm); let gameFW = 1; if (g.tags && g.tags.length > 0) { let foundVersions = []; g.tags.forEach(tag => { const matches = tag.match(/(\d+)\.xx/gi); if (matches) matches.forEach(m => { const num = parseInt(m.match(/\d+/)[0], 10); foundVersions.push(num); }); }); if (foundVersions.length > 0) gameFW = Math.min(...foundVersions); } return matchesSearch && gameFW <= selectedFW; });
    if (statsSpan) statsSpan.textContent = searchResults.length;
    if (searchResults.length === 0) { if (resultsContainer) resultsContainer.innerHTML = '<div class="no-results">😔 Nessun gioco trovato per "' + escapeHtml(lowerTerm) + '"</div>'; return; }
    if (resultsContainer) {
        resultsContainer.innerHTML = searchResults.map(game => `<div class="search-result-item" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'><img class="search-result-img" src="${game.image}" alt="${game.title}" loading="lazy" referrerpolicy="no-referrer"><div class="search-result-info"><div class="search-result-title">${escapeHtml(game.title)}</div><div class="search-result-tags">${(game.tags || []).slice(0, 3).map(t => `<span class="search-result-tag">${escapeHtml(t)}</span>`).join('')}${(game.tags || []).length > 3 ? `<span class="search-result-tag">+${game.tags.length - 3}</span>` : ''}</div></div>${game.size ? `<div class="search-result-size">${game.size}</div>` : ''}</div>`).join('');
        document.querySelectorAll('.search-result-item').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); const gameDataAttr = el.getAttribute('data-game'); if (gameDataAttr) { try { const decoded = gameDataAttr.replace(/&quot;/g, '"').replace(/&#39;/g, "'"); const game = JSON.parse(decoded); const overlay = document.getElementById('searchModalOverlay'); if (overlay) overlay.classList.remove('active'); setTimeout(() => { isRandomModeActive = false; openGameModal(game, e); }, 300); } catch(err) { console.error("Errore:", err); } } }); });
    }
}

function performSearchOnGridExternal(term) {
    const lowerTerm = term.toLowerCase().trim();
    const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
    const sortValue = document.getElementById('sort-filter').value;
    if (!lowerTerm) { applyFWFilterWithSort(); currentPage = 1; renderGames(); updateResultCount(); scrollToTop(true); return; }
    const searchResults = allGames.filter(g => { const matchesSearch = g.title.toLowerCase().includes(lowerTerm); let gameFW = 1; if (g.tags && g.tags.length > 0) { let foundVersions = []; g.tags.forEach(tag => { const matches = tag.match(/(\d+)\.xx/gi); if (matches) matches.forEach(m => { const num = parseInt(m.match(/\d+/)[0], 10); foundVersions.push(num); }); }); if (foundVersions.length > 0) gameFW = Math.min(...foundVersions); } return matchesSearch && gameFW <= selectedFW; });
    filteredGames = sortGames(searchResults, sortValue);
    currentPage = 1; renderGames(); updateResultCount(); scrollToTop(true);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; });
}

function openGameModal(game, event) {
    if (event && event.button === 2) { event.preventDefault(); return false; }
    if (hasMoved || window._wasDrag) { hasMoved = false; window._wasDrag = false; return false; }
    hasMoved = false; window._wasDrag = false;
    gameTitlePlaceholder = game.title.replace(/'/g, "\\'");
    fileAuthPlaceholder = game.credits_files || '';
    bpAuthPlaceholder = game.credits_backport || '';
    dlcAuthPlaceholder = game.credits_dlc || game.credits_dlcs || '';
    hPlayPlaceholder = (game.how_to_play || "").replace(/'/g, "\\'");
    const modalHeader = document.getElementById('modal-header');
    modalHeader.style.backgroundImage = `url('${game.image}')`;
    modalHeader.style.backgroundSize = 'cover';
    modalHeader.style.backgroundPosition = 'center';
    document.getElementById('modal-title').textContent = game.title;
    document.getElementById('modal-tags').innerHTML = (game.tags || []).map(t => `<span class="modal-tag">${escapeHtml(t)}</span>`).join('');
    document.getElementById('modal-size').textContent = game.size || 'N/A';

    const aprEmuBadge = document.getElementById('modal-apr-emu-badge');
    const requireAprEmu = (game.apr_emu === "on" || game.apr_emu === true || game.apr_emu === "true");
    if (requireAprEmu) {
        aprEmuBadge.innerHTML = '<div class="modal-apr-emu">APR-EMU</div><button class="apr-emu-update-btn" onclick="openAprEmuModal()">⚠️ Need APR-EMU update? Check here</button>';
        aprEmuBadge.style.display = 'block';
    } else {
        aprEmuBadge.innerHTML = '';
        aprEmuBadge.style.display = 'none';
    }
    
    const downloadsContainer = document.getElementById('modal-downloads');
    const createModalBtnLocal = (url, label, isDump = false) => { if (!url || url === "undefined" || url.trim() === "") return ''; const dumpAttr = isDump ? 'true' : 'false'; return `<button onclick="startDownloadFromModal('${url}', '${fileAuthPlaceholder}', '${bpAuthPlaceholder}', '${dlcAuthPlaceholder}', '${hPlayPlaceholder}', false, ${dumpAttr}, '${game.title.replace(/'/g, "\\'")}', ${requireAprEmu})" class="modal-btn">${label}</button>`; };
    let downloadsHTML = '';
    const hasBackport7 = game.backport7xx_akia || game.backport7xx_viki || game.backport7xx_buzz || game.backport7xx_data;
    const hasBackport4 = game.backport4xx_akia || game.backport4xx_viki || game.backport4xx_buzz || game.backport4xx_data;
    if (hasBackport7 || hasBackport4) {
        let bp7 = '', bp4 = '';
        if (hasBackport7) { if (game.backport7xx_akia) bp7 += createModalBtnLocal(game.backport7xx_akia, 'AKIA'); if (game.backport7xx_viki) bp7 += createModalBtnLocal(game.backport7xx_viki, 'VIKI'); if (game.backport7xx_buzz) bp7 += createModalBtnLocal(game.backport7xx_buzz, 'BUZZ'); if (game.backport7xx_data) bp7 += createModalBtnLocal(game.backport7xx_data, 'DATA'); }
        if (hasBackport4) { if (game.backport4xx_akia) bp4 += createModalBtnLocal(game.backport4xx_akia, 'AKIA'); if (game.backport4xx_viki) bp4 += createModalBtnLocal(game.backport4xx_viki, 'VIKI'); if (game.backport4xx_buzz) bp4 += createModalBtnLocal(game.backport4xx_buzz, 'BUZZ'); if (game.backport4xx_data) bp4 += createModalBtnLocal(game.backport4xx_data, 'DATA'); }
        downloadsHTML = `${bp7 ? `<div style="width:100%; margin-bottom:10px;"><strong>Backport 7.xx</strong></div>${bp7}` : ''}${bp4 ? `<div style="width:100%; margin-bottom:10px; margin-top:10px;"><strong>Backport 4.xx</strong></div>${bp4}` : ''}`;
    } else if (game.standard_akia || game.standard_viki || game.standard_buzz || game.standard_data || game.backport_akia || game.backport_viki || game.backport_buzz || game.backport_data) {
        let std = '', bp = '';
        if (game.standard_akia) std += createModalBtnLocal(game.standard_akia, 'AKIA'); if (game.standard_viki) std += createModalBtnLocal(game.standard_viki, 'VIKI'); if (game.standard_buzz) std += createModalBtnLocal(game.standard_buzz, 'BUZZ'); if (game.standard_data) std += createModalBtnLocal(game.standard_data, 'DATA');
        if (game.backport_akia) bp += createModalBtnLocal(game.backport_akia, 'AKIA'); if (game.backport_viki) bp += createModalBtnLocal(game.backport_viki, 'VIKI'); if (game.backport_buzz) bp += createModalBtnLocal(game.backport_buzz, 'BUZZ'); if (game.backport_data) bp += createModalBtnLocal(game.backport_data, 'DATA');
        downloadsHTML = `${std ? `<div style="width:100%; margin-bottom:10px;"><strong>STANDARD</strong></div>${std}` : ''}${bp ? `<div style="width:100%; margin-bottom:10px; margin-top:10px;"><strong>BACKPORT</strong></div>${bp}` : ''}`;
    } else {
        let btns = '';
        if (game.akia_url) btns += createModalBtnLocal(game.akia_url, 'AKIA'); if (game.viki_url) btns += createModalBtnLocal(game.viki_url, 'VIKI'); if (game.buzz_url) btns += createModalBtnLocal(game.buzz_url, 'BUZZ'); if (game.data_url) btns += createModalBtnLocal(game.data_url, 'DATA');
        downloadsHTML = btns;
    }
    downloadsContainer.innerHTML = downloadsHTML;
    const dumpSection = document.getElementById('modal-dump-section');
    const dumpContainer = document.getElementById('modal-dump');
    let dumpHTML = '';
    const hasDump = game.dump_akia || game.dump_viki || game.dump_buzz || game.dump_data;
    if (hasDump) { if (game.dump_akia) dumpHTML += createModalBtnLocal(game.dump_akia, 'AKIA', true); if (game.dump_viki) dumpHTML += createModalBtnLocal(game.dump_viki, 'VIKI', true); if (game.dump_buzz) dumpHTML += createModalBtnLocal(game.dump_buzz, 'BUZZ', true); if (game.dump_data) dumpHTML += createModalBtnLocal(game.dump_data, 'DATA', true); dumpSection.style.display = 'block'; dumpContainer.innerHTML = dumpHTML; } else dumpSection.style.display = 'none';
    const dlcSection = document.getElementById('modal-dlc-section');
    const dlcContainer = document.getElementById('modal-dlc');
    let dlcBtns = '';
    if (game.dlc_akia) dlcBtns += createModalBtnLocal(game.dlc_akia, 'AKIA'); if (game.dlc_viki) dlcBtns += createModalBtnLocal(game.dlc_viki, 'VIKI'); if (game.dlc_buzz) dlcBtns += createModalBtnLocal(game.dlc_buzz, 'BUZZ'); if (game.dlc_data) dlcBtns += createModalBtnLocal(game.dlc_data, 'DATA');
    if (dlcBtns) { dlcSection.style.display = 'block'; dlcContainer.innerHTML = dlcBtns; } else dlcSection.style.display = 'none';
    
    let parts = [];
    const fileAuthor = game.credits_files, bpAuthor = game.credits_backport, dlcAuthor = game.credits_dlc || game.credits_dlcs;
    
    if (fileAuthor && bpAuthor && fileAuthor === bpAuthor) {
        if (dlcAuthor) {
            parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with BackPort and <b>${escapeHtml(dlcAuthor)}</b> for DLCs`);
        } else {
            parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with BackPort`);
        }
    }
    else if (fileAuthor && dlcAuthor && fileAuthor === dlcAuthor) {
        parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with DLCs`);
        if (bpAuthor && bpAuthor !== fileAuthor) {
            parts.push(`<b>${escapeHtml(bpAuthor)}</b> for the BackPort`);
        }
    }
    else {
        if (fileAuthor) parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files`);
        if (dlcAuthor) parts.push(`<b>${escapeHtml(dlcAuthor)}</b> for DLCs`);
        if (bpAuthor) parts.push(`<b>${escapeHtml(bpAuthor)}</b> for the BackPort`);
    }
    
    let creditsText = parts.length > 0 ? "Thanks to " + parts.join(", ").replace(/, ([^,]*)$/, ' and $1') : "Thanks to the community.";
    document.getElementById('modal-credits').innerHTML = creditsText;
    
    const instSection = document.getElementById('modal-instructions');
    if (game.how_to_play) { instSection.style.display = 'block'; document.getElementById('modal-instructions-text').innerHTML = game.how_to_play; } else instSection.style.display = 'none';
    const updatesSection = document.getElementById('modal-updates');
    const updatesList = document.getElementById('modal-updates-list');
    const updates = allUpdates[game.title];
    if (updates && updates.length > 0) {
        updatesSection.style.display = 'block';
        updatesList.innerHTML = updates.map(upd => { const dp = upd.date.split('-'); const formattedDate = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : upd.date; return `<div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:8px;"><div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;"><div><strong>${escapeHtml(upd.version)}</strong> <small style="opacity:0.6;">(${upd.size || 'N/A'})</small><br><small style="color:var(--cyan-neon);">Released: ${formattedDate}</small></div><div style="display:flex; gap:8px;">${upd.akia_url ? `<a href="${upd.akia_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">AKIA</a>` : ''}${upd.viki_url ? `<a href="${upd.viki_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">VIKI</a>` : ''}${upd.buzz_url ? `<a href="${upd.buzz_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">BUZZ</a>` : ''}${upd.data_url ? `<a href="${upd.data_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">DATA</a>` : ''}</div></div></div>`; }).join('');
    } else updatesSection.style.display = 'none';
    const modalRandomBtn = document.getElementById('modalRandomBtn');
    if (modalRandomBtn) { if (isRandomModeActive) modalRandomBtn.style.display = 'flex'; else modalRandomBtn.style.display = 'none'; }
    document.getElementById('game-detail-modal').style.display = 'block';
}

function attachPopularCardEvents() {
    let pressTimer = null, isLongPressActive = false, touchMoved = false;
    const cards = document.querySelectorAll('.popular-card');
    cards.forEach(card => {
        const oldCard = card.cloneNode(true);
        card.parentNode.replaceChild(oldCard, card);
        oldCard.addEventListener('click', function(e) { e.stopPropagation(); if (isLongPressActive) return; const gameDataAttr = this.getAttribute('data-game'); if (gameDataAttr) { try { const decoded = gameDataAttr.replace(/&quot;/g, '"').replace(/&#39;/g, "'"); const game = JSON.parse(decoded); isRandomModeActive = false; openGameModal(game, e); } catch(err) { console.error("Errore:", err); } } });
        oldCard.addEventListener('touchstart', function(e) { touchMoved = false; isLongPressActive = false; window._isLongPress = false; pressTimer = setTimeout(() => { isLongPressActive = true; window._isLongPress = true; this.style.opacity = '0.7'; const container = document.getElementById('carousel-container'); const dragEvent = new TouchEvent('touchstart', { touches: e.touches, target: container, cancelable: true }); container.dispatchEvent(dragEvent); }, 200); });
        oldCard.addEventListener('touchmove', function(e) { touchMoved = true; if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
        oldCard.addEventListener('touchend', function(e) { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } this.style.opacity = ''; if (!isLongPressActive && !touchMoved) { setTimeout(() => { if (!window._wasDrag) { const clickEvent = new MouseEvent('click', { view: window, bubbles: true, cancelable: true }); this.dispatchEvent(clickEvent); } }, 10); } setTimeout(() => { window._isLongPress = false; isLongPressActive = false; }, 100); });
        oldCard.addEventListener('touchcancel', function(e) { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } this.style.opacity = ''; window._isLongPress = false; isLongPressActive = false; });
    });
}

function renderPopularGames() {
    const track = document.getElementById('popular-track');
    const section = document.getElementById('popular-section');
    if (!track || !section) return;
    const popularGames = allGames.filter(g => g.popular === "on");
    if (popularGames.length === 0) { section.style.display = 'none'; return; }
    const isMobile = window.innerWidth <= 768;
    if (cachedPopularGames && cachedIsMobile === isMobile) {
        let htmlContent = '';
        cachedPopularGames.forEach(game => { let updateBadge = ''; const updates = allUpdates[game.title]; if (updates && updates.length > 0) { const lastUpdateDate = new Date(updates[0].date); const now = new Date(); const diffInHours = (now - lastUpdateDate) / (1000 * 60 * 60); if (diffInHours >= 0 && diffInHours <= 24) updateBadge = `<div class="update-badge-popular">UPDATE</div>`; } htmlContent += `<div class="popular-card" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'><div class="popular-card-bg" style="background-image: url('${game.image}')"></div><div class="popular-card-gradient"></div>${updateBadge}<div class="popular-card-content"><div class="popular-card-header"><div class="popular-game-title">${escapeHtml(game.title)}</div>${game.size ? `<div class="popular-size"> ${game.size}</div>` : ''}</div></div><div class="click-hint">✨ Click for details</div></div>`; });
        track.innerHTML = htmlContent + htmlContent;
        attachPopularCardEvents();
        return;
    }
    section.style.display = 'flex';
    const maxPopularGames = isMobile ? 10 : 20;
    let selectedGames = [...popularGames];
    for (let i = selectedGames.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [selectedGames[i], selectedGames[j]] = [selectedGames[j], selectedGames[i]]; }
    selectedGames = selectedGames.slice(0, maxPopularGames);
    cachedPopularGames = selectedGames;
    cachedIsMobile = isMobile;
    let htmlContent = '';
    selectedGames.forEach(game => { let updateBadge = ''; const updates = allUpdates[game.title]; if (updates && updates.length > 0) { const lastUpdateDate = new Date(updates[0].date); const now = new Date(); const diffInHours = (now - lastUpdateDate) / (1000 * 60 * 60); if (diffInHours >= 0 && diffInHours <= 24) updateBadge = `<div class="update-badge-popular">UPDATE</div>`; } htmlContent += `<div class="popular-card" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'><div class="popular-card-bg" style="background-image: url('${game.image}')"></div><div class="popular-card-gradient"></div>${updateBadge}<div class="popular-card-content"><div class="popular-card-header"><div class="popular-game-title">${escapeHtml(game.title)}</div>${game.size ? `<div class="popular-size"> ${game.size}</div>` : ''}</div></div><div class="click-hint">✨ Click for details</div></div>`; });
    track.innerHTML = htmlContent + htmlContent;
    attachPopularCardEvents();
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => { const wasMobile = cachedIsMobile; const isMobile = window.innerWidth <= 768; if (wasMobile !== isMobile && cachedPopularGames) { cachedPopularGames = null; renderPopularGames(); } }, 250);
});

function renderGames() {
    const grid = document.getElementById('game-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredGames.slice(startIndex, startIndex + itemsPerPage);
    if (pageItems.length === 0) { grid.innerHTML = '<p style="text-align:center; width:100%; font-size:1.5rem;">Nessun gioco trovato.</p>'; return; }
    pageItems.forEach(game => {
        let tagsHTML = (game.tags || []).map(t => `<span class="game-tag">${escapeHtml(t)}</span>`).join('');
        let sizeHTML = '';
        let aprEmuHTML = '';
        
        if (game.size) {
            sizeHTML = `<div class="game-size">${game.size}</div>`;
        }
        
        const requireAprEmu = (game.apr_emu === "on" || game.apr_emu === true || game.apr_emu === "true");
        if (requireAprEmu) {
            aprEmuHTML = `<div class="game-apr-emu">APR-EMU</div>`;
        }
        
        let updateBadge = '';
        const updates = allUpdates[game.title];
        if (updates && updates.length > 0) { const lastUpdateDate = new Date(updates[0].date); const now = new Date(); const diffInHours = (now - lastUpdateDate) / (1000 * 60 * 60); if (diffInHours >= 0 && diffInHours <= 24) updateBadge = `<div class="update-badge" style="position:absolute; top:15px; left:15px; background:var(--green-neon); color:#000; padding:4px 10px; border-radius:8px; font-weight:900; font-size:0.7rem; z-index:20; box-shadow:0 0 10px var(--green-neon); animation: pulseRed 2s infinite;">UPDATE</div>`; }
        const hPlay = (game.how_to_play || "").replace(/'/g, "\\'");
        const dCredits = game.credits_dlc || game.credits_dlcs || '';
        const createBtn = (url, label, isDLC = false, isDump = false) => { 
            if (!url || url === "undefined" || url.trim() === "") return ''; 
            return `<a onclick="openDLWithAprEmuCheck('${url}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}', ${isDLC}, ${isDump}, '${game.title.replace(/'/g, "\\'")}', ${requireAprEmu})" class="btn-dl">${label}</a>`; 
        };
        let downloadHTML = '';
        let dlcBtns = '';
        let dumpBtns = '';
        if (game.dump_akia) dumpBtns += createBtn(game.dump_akia, 'AKIA', false, true);
        if (game.dump_viki) dumpBtns += createBtn(game.dump_viki, 'VIKI', false, true);
        if (game.dump_buzz) dumpBtns += createBtn(game.dump_buzz, 'BUZZ', false, true);
        if (game.dump_data) dumpBtns += createBtn(game.dump_data, 'DATA', false, true);
        if (game.dlc_akia) dlcBtns += createBtn(game.dlc_akia, 'AKIA', true);
        if (game.dlc_viki) dlcBtns += createBtn(game.dlc_viki, 'VIKI', true);
        if (game.dlc_buzz) dlcBtns += createBtn(game.dlc_buzz, 'BUZZ', true);
        if (game.dlc_data) dlcBtns += createBtn(game.dlc_data, 'DATA', true);
        const hasBackport7 = game.backport7xx_akia || game.backport7xx_viki || game.backport7xx_buzz || game.backport7xx_data;
        const hasBackport4 = game.backport4xx_akia || game.backport4xx_viki || game.backport4xx_buzz || game.backport4xx_data;
        if (hasBackport7 || hasBackport4) {
            let bp7 = '', bp4 = '';
            if (hasBackport7) { if (game.backport7xx_akia) bp7 += createBtn(game.backport7xx_akia, 'AKIA'); if (game.backport7xx_viki) bp7 += createBtn(game.backport7xx_viki, 'VIKI'); if (game.backport7xx_buzz) bp7 += createBtn(game.backport7xx_buzz, 'BUZZ'); if (game.backport7xx_data) bp7 += createBtn(game.backport7xx_data, 'DATA'); }
            if (hasBackport4) { if (game.backport4xx_akia) bp4 += createBtn(game.backport4xx_akia, 'AKIA'); if (game.backport4xx_viki) bp4 += createBtn(game.backport4xx_viki, 'VIKI'); if (game.backport4xx_buzz) bp4 += createBtn(game.backport4xx_buzz, 'BUZZ'); if (game.backport4xx_data) bp4 += createBtn(game.backport4xx_data, 'DATA'); }
            downloadHTML = `${bp7 ? `<p class="ver-label"><b>BP 7.xx:</b></p><div class="download-container">${bp7}</div>` : ''}${bp4 ? `<p class="ver-label"><b>BP 4.xx:</b></p><div class="download-container">${bp4}</div>` : ''}`;
        } else if (game.standard_akia || game.standard_viki || game.standard_buzz || game.standard_data || game.backport_akia || game.backport_viki || game.backport_buzz || game.backport_data) {
            let std = '', bp = '';
            if (game.standard_akia) std += createBtn(game.standard_akia, 'AKIA'); if (game.standard_viki) std += createBtn(game.standard_viki, 'VIKI'); if (game.standard_buzz) std += createBtn(game.standard_buzz, 'BUZZ'); if (game.standard_data) std += createBtn(game.standard_data, 'DATA');
            if (game.backport_akia) bp += createBtn(game.backport_akia, 'AKIA'); if (game.backport_viki) bp += createBtn(game.backport_viki, 'VIKI'); if (game.backport_buzz) bp += createBtn(game.backport_buzz, 'BUZZ'); if (game.backport_data) bp += createBtn(game.backport_data, 'DATA');
            downloadHTML = `${std ? `<p class="ver-label"><b>STANDARD:</b></p><div class="download-container">${std}</div>` : ''}${bp ? `<p class="ver-label"><b>BACKPORT:</b></p><div class="download-container">${bp}</div>` : ''}`;
        } else {
            let btns = '';
            if (game.akia_url) btns += createBtn(game.akia_url, 'AKIA'); if (game.viki_url) btns += createBtn(game.viki_url, 'VIKI'); if (game.buzz_url) btns += createBtn(game.buzz_url, 'BUZZ'); if (game.data_url) btns += createBtn(game.data_url, 'DATA');
            downloadHTML = `<div class="download-container" style="margin-top:15px;">${btns}</div>`;
        }
        let dumpSectionHTML = dumpBtns ? `<p class="ver-label"><b>DUMP:</b></p><div class="download-container">${dumpBtns}</div>` : '';
        let dlcSectionHTML = dlcBtns ? `<p class="ver-label"><b>DLCs:</b></p><div class="download-container">${dlcBtns}</div>` : '';
        
        grid.innerHTML += `<div class="game-card">${updateBadge}<span class="game-title">${escapeHtml(game.title)}</span><div class="image-container"><img src="${game.image}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/400x400/0a0a1a/cyan?text=No+Image'"><div class="tags-overlay">${tagsHTML}</div><div class="game-badges">${aprEmuHTML}${sizeHTML}</div></div><div class="download-section">${downloadHTML}${dumpSectionHTML}${dlcSectionHTML}</div></div>`;
    });
    const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
    document.getElementById('page-info').innerText = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
    
    const pageJumpInput = document.getElementById('pageJumpInput');
    if (pageJumpInput) {
        if (pageJumpInput.value === "") {
        } else {
            pageJumpInput.value = currentPage;
        }
        pageJumpInput.max = totalPages;
    }
}

function setupPageJump() {
    const paginationDiv = document.querySelector('.pagination');
    if (!paginationDiv) return;
    
    let jumpWrapper = document.getElementById('pageJumpWrapper');
    if (!jumpWrapper) {
        jumpWrapper = document.createElement('div');
        jumpWrapper.id = 'pageJumpWrapper';
        jumpWrapper.className = 'page-jump-wrapper';
        
        const jumpInput = document.createElement('input');
        jumpInput.type = 'number';
        jumpInput.id = 'pageJumpInput';
        jumpInput.className = 'page-jump-input';
        jumpInput.placeholder = 'Page';
        jumpInput.min = '1';
        jumpInput.value = '1';
        
        const jumpBtn = document.createElement('button');
        jumpBtn.id = 'pageJumpBtn';
        jumpBtn.className = 'page-jump-btn';
        jumpBtn.textContent = 'GO';
        
        jumpWrapper.appendChild(jumpInput);
        jumpWrapper.appendChild(jumpBtn);
        
        const pageInfo = document.getElementById('page-info');
        if (pageInfo && pageInfo.parentNode) {
            pageInfo.parentNode.insertBefore(jumpWrapper, pageInfo.nextSibling);
        }
    }
    
    let jumpIcon = document.getElementById('pageJumpIconBtn');
    if (!jumpIcon) {
        jumpIcon = document.createElement('button');
        jumpIcon.id = 'pageJumpIconBtn';
        jumpIcon.className = 'page-jump-icon';
        jumpIcon.innerHTML = '⛭';
        jumpIcon.title = 'Go to page';
        
        const pageInfo = document.getElementById('page-info');
        if (pageInfo && pageInfo.parentNode) {
            pageInfo.parentNode.insertBefore(jumpIcon, pageInfo.nextSibling);
        }
    }
    
    let jumpModal = document.getElementById('pageJumpModal');
    if (!jumpModal) {
        jumpModal = document.createElement('div');
        jumpModal.id = 'pageJumpModal';
        jumpModal.className = 'page-jump-modal';
        jumpModal.innerHTML = `
            <div class="page-jump-modal-content">
                <div class="page-jump-modal-header">
                    <h3>Jump to Page</h3>
                    <span class="page-jump-modal-close">&times;</span>
                </div>
                <div class="page-jump-modal-body">
                    <input type="number" id="pageJumpModalInput" class="page-jump-modal-input" placeholder="Enter page number" min="1">
                    <button id="pageJumpModalBtn" class="page-jump-modal-btn">GO</button>
                </div>
            </div>
        `;
        document.body.appendChild(jumpModal);
    }
    
    const jumpInput = document.getElementById('pageJumpInput');
    const jumpBtn = document.getElementById('pageJumpBtn');
    const jumpIconBtn = document.getElementById('pageJumpIconBtn');
    const modal = document.getElementById('pageJumpModal');
    const modalClose = document.querySelector('.page-jump-modal-close');
    const modalBtn = document.getElementById('pageJumpModalBtn');
    const modalInput = document.getElementById('pageJumpModalInput');
    
    const executeJump = (targetPage) => {
        const total = Math.ceil(filteredGames.length / itemsPerPage);
        let page = parseInt(targetPage);
        if (isNaN(page)) page = 1;
        page = Math.max(1, Math.min(page, total));
        if (page !== currentPage) {
            currentPage = page;
            renderGames();
            scrollToTop(true);
            if (jumpBtn) {
                jumpBtn.style.animation = 'jumpPulse 0.5s ease';
                setTimeout(() => { if (jumpBtn) jumpBtn.style.animation = ''; }, 500);
            }
        }
        if (jumpInput) jumpInput.value = currentPage;
        if (modalInput) modalInput.value = currentPage;
        if (modal && modal.classList.contains('show')) modal.classList.remove('show');
    };
    
    if (jumpBtn) jumpBtn.addEventListener('click', () => { if (jumpInput) executeJump(jumpInput.value); });
    if (jumpInput) jumpInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeJump(jumpInput.value); });
    
    if (jumpIconBtn && modal) {
        jumpIconBtn.addEventListener('click', () => {
            const total = Math.ceil(filteredGames.length / itemsPerPage);
            if (modalInput) {
                modalInput.value = currentPage;
                modalInput.max = total;
                modalInput.min = 1;
            }
            modal.classList.add('show');
        });
    }
    
    if (modalClose && modal) modalClose.addEventListener('click', () => modal.classList.remove('show'));
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
    if (modalBtn && modalInput) modalBtn.addEventListener('click', () => executeJump(modalInput.value));
    if (modalInput) modalInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeJump(modalInput.value); });
}

document.getElementById('modal-close-btn').onclick = () => { document.getElementById('game-detail-modal').style.display = 'none'; isRandomModeActive = false; };
window.onclick = (e) => { if (e.target.classList.contains('game-modal')) { e.target.style.display = 'none'; isRandomModeActive = false; } };
window.addEventListener('DOMContentLoaded', init);
window.addEventListener('scroll', () => { const nav = document.querySelector('nav'); if (nav) { if (window.scrollY > 20) nav.classList.add('scrolled'); else nav.classList.remove('scrolled'); } });
document.getElementById('next-page').onclick = () => { currentPage++; renderGames(); scrollToTop(true); };
document.getElementById('prev-page').onclick = () => { currentPage--; renderGames(); scrollToTop(true); };