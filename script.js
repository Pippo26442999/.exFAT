let IS_BOT = false;
let mouseMoved = false;
let touchEvents = false;

// Rilevamento immediato
(function() {
    // Controllo webdriver
    if (navigator.webdriver === true) IS_BOT = true;
    
    // Controllo User-Agent headless
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("headless") || ua.includes("phantom") || ua.includes("puppeteer")) IS_BOT = true;
    
    // Controllo plugins (headless ha 0)
    if (navigator.plugins && navigator.plugins.length === 0) IS_BOT = true;
    
    // Controllo languages
    if (!navigator.languages || navigator.languages.length === 0) IS_BOT = true;
    
    // Cookie disabled?
    if (!navigator.cookieEnabled) IS_BOT = true;
})();

// Honeypot: elemento invisibile
document.addEventListener('DOMContentLoaded', () => {
    const honeypot = document.createElement('div');
    honeypot.id = 'honeypot-link';
    honeypot.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:1px; height:1px; opacity:0;';
    honeypot.innerHTML = '<a href="#" id="fake-download-link">Download</a>';
    document.body.appendChild(honeypot);
    
    const fakeLink = document.getElementById('fake-download-link');
    if (fakeLink) {
        fakeLink.addEventListener('click', (e) => {
            e.preventDefault();
            IS_BOT = true;
            sessionStorage.setItem('flagged_as_bot', 'true');
            document.body.innerHTML = '<h1 style="color:red; text-align:center; margin-top:20%;">Access Denied</h1><p>Automated access detected.</p>';
            throw new Error("Bot detected");
        });
    }
});

// Rilevamento interazione umana
document.addEventListener('mousemove', () => { mouseMoved = true; });
document.addEventListener('touchstart', () => { touchEvents = true; });

// Timeout challenge
const startTime = Date.now();
setTimeout(() => {
    const timeSpent = Date.now() - startTime;
    if (timeSpent < 2000 && !mouseMoved && !touchEvents) {
        IS_BOT = true;
        sessionStorage.setItem('flagged_as_bot', 'true');
    }
}, 3000);

// Blocca fetch se bot
if (IS_BOT || sessionStorage.getItem('flagged_as_bot') === 'true') {
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        if (args[0] && String(args[0]).includes('exFAT.json')) {
            return Promise.reject(new Error("Access denied"));
        }
        return originalFetch.apply(this, args);
    };
}

// Generatore di giochi falsi per honeypot
function generateFakeGames(count) {
    const fakeGames = [];
    const fakeTitles = ["FAKE_SCANNER_DETECTED", "HONEYPOT_TRAP", "SCRAPER_BLOCKED", "ACCESS_DENIED", "BOT_DETECTED"];
    for (let i = 0; i < count; i++) {
        fakeGames.push({
            title: `${fakeTitles[i % fakeTitles.length]}_${i}`,
            image: "https://placehold.co/400x400/0a0a1a/red?text=BLOCKED",
            size: "999 GB",
            tags: ["FAKE", "HONEYPOT", "SCRAPER"],
            akia_url: "#",
            viki_url: "#",
            buzz_url: "#",
            data_url: "#",
            credits_files: "Anti-Scraper System",
            how_to_play: "You are a bot. Access denied."
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
            if (hintElement && hintElement.parentNode) {
                hintElement.style.display = 'none';
            }
        }, 600);
    }, delayMilliseconds);
}

function showSkeletonLoader() {
    const grid = document.getElementById('game-grid');
    if (!grid) return;
    
    const skeletonHTML = Array(21).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-title shimmer"></div>
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-download shimmer"></div>
            <div class="skeleton-download shimmer" style="width: 80%;"></div>
        </div>
    `).join('');
    
    grid.innerHTML = skeletonHTML;
}

function hideSkeletonLoader() {
    const skeletons = document.querySelectorAll('.skeleton-card');
    skeletons.forEach(s => s.remove());
}

function scrollToTop(smooth = true) {
    if (!smooth) {
        window.scrollTo(0, 0);
        return;
    }
    
    const startPosition = window.pageYOffset;
    const targetPosition = 0;
    const distance = startPosition - targetPosition;
    const duration = 600;
    let startTime = null;
    
    const easeOutCubic = (t) => {
        return 1 - Math.pow(1 - t, 3);
    };
    
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const easeProgress = easeOutCubic(progress);
        
        window.scrollTo(0, startPosition - (distance * easeProgress));
        
        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        }
    }
    
    requestAnimationFrame(animation);
}

function showBackToTopButton() {
    const existingBtn = document.getElementById('backToTopBtn');
    if (existingBtn) return;
    
    const btn = document.createElement('div');
    btn.id = 'backToTopBtn';
    btn.innerHTML = '';
    btn.className = 'back-to-top';
    btn.title = '';
    btn.onclick = () => scrollToTop(true);
    document.body.appendChild(btn);
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });
}

function updateResultCount() {
    const count = filteredGames.length;
    const container = document.getElementById('result-count-text');
    if (container) {
        container.textContent = `${count} game${count !== 1 ? 's' : ''} found`;
    }
}

function resetFilters() {
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
    
    localStorage.setItem('preferred_fw', '99');
    localStorage.setItem('preferred_sort', 'default');
    
    const searchInput = document.getElementById('searchModalInput');
    if (searchInput) searchInput.value = '';
    
    applyFWFilterWithSort();
    currentPage = 1;
    renderGames();
    scrollToTop(true);
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
        case 'az':
            return sorted.sort((a, b) => a.title.localeCompare(b.title));
        case 'za':
            return sorted.sort((a, b) => b.title.localeCompare(a.title));
        case 'size-asc':
            return sorted.sort((a, b) => sizeToBytes(a.size) - sizeToBytes(b.size));
        case 'size-desc':
            return sorted.sort((a, b) => sizeToBytes(b.size) - sizeToBytes(a.size));
        case 'popular':
            return sorted.filter(g => g.popular === "on");
        case 'default':
            return sorted.sort((a, b) => {
                const indexA = originalOrderMap.get(a.title) || 0;
                const indexB = originalOrderMap.get(b.title) || 0;
                return indexA - indexB;
            });
        default:
            return sorted;
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
                    if (matches) {
                        matches.forEach(m => {
                            const num = parseInt(m.match(/\d+/)[0], 10);
                            foundVersions.push(num);
                        });
                    }
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
    
    trigger.onclick = (e) => { 
        e.stopPropagation(); 
        optionsContainer.classList.toggle('show'); 
        sortDropdown.classList.toggle('active');
    };
    
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
        
        mobileTrigger.onclick = (e) => {
            e.stopPropagation();
            mobileOptions.classList.toggle('show');
            mobileSortDropdown.classList.toggle('active');
        };
        
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
    
    window.addEventListener('click', () => { 
        optionsContainer.classList.remove('show'); 
        sortDropdown.classList.remove('active');
        if (mobileSortDropdown) {
            const mobileOpts = document.getElementById('mobile-sort-options');
            if (mobileOpts) mobileOpts.classList.remove('show');
            mobileSortDropdown.classList.remove('active');
        }
    });
}

function saveFWFilter(value) {
    localStorage.setItem('preferred_fw', value);
}

function loadFWPreference() {
    const saved = localStorage.getItem('preferred_fw');
    if (saved && saved !== '99') {
        document.getElementById('fw-filter').value = saved;
        const fwOption = document.querySelector(`#fw-options .option[data-value="${saved}"]`);
        if (fwOption) {
            document.getElementById('fw-current').innerText = fwOption.innerText;
            const mobileFwCurrent = document.getElementById('mobile-fw-current');
            if (mobileFwCurrent) mobileFwCurrent.innerText = fwOption.innerText;
            const mobileFwFilter = document.getElementById('mobile-fw-filter');
            if (mobileFwFilter) mobileFwFilter.value = saved;
        }
        return saved;
    }
    return '99';
}

function loadSortPreference() {
    const saved = localStorage.getItem('preferred_sort');
    if (saved && saved !== 'default') {
        document.getElementById('sort-filter').value = saved;
        const optionText = document.querySelector(`#sort-options .option[data-value="${saved}"]`)?.innerText || 'Sort: Default';
        document.getElementById('sort-current').innerText = optionText;
        const mobileCurrent = document.getElementById('mobile-sort-current');
        if (mobileCurrent) mobileCurrent.innerText = optionText;
        const mobileFilter = document.getElementById('mobile-sort-filter');
        if (mobileFilter) mobileFilter.value = saved;
        return saved;
    }
    document.getElementById('sort-filter').value = 'default';
    document.getElementById('sort-current').innerText = 'Sort: Default';
    const mobileCurrent = document.getElementById('mobile-sort-current');
    if (mobileCurrent) mobileCurrent.innerText = 'Sort: Default';
    const mobileFilter = document.getElementById('mobile-sort-filter');
    if (mobileFilter) mobileFilter.value = 'default';
    return 'default';
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
                    if (matches) {
                        matches.forEach(m => {
                            const num = parseInt(m.match(/\d+/)[0], 10);
                            foundVersions.push(num);
                        });
                    }
                });
                if (foundVersions.length > 0) gameFW = Math.min(...foundVersions);
            }
            return gameFW <= selectedFW;
        });
    }
    
    filteredGames = sortGames(tempFiltered, sortValue);
    updateResultCount();
}

function applyFWFilter() {
    applyFWFilterWithSort();
}

async function init() {
    // Se flaggato come bot, mostra solo messaggio finto
    const isFlagged = sessionStorage.getItem('flagged_as_bot') === 'true' || IS_BOT;
    
    if (isFlagged) {
        const overlay = document.getElementById('site-lock-overlay');
        if (overlay) overlay.remove();
        
        const grid = document.getElementById('game-grid');
        if (grid) {
            grid.innerHTML = `<div style="text-align:center; padding:60px; grid-column:1/-1;">
                <h2 style="color:var(--cyan-neon);">Access Restricted</h2>
                <p>Temporarily unavailable. Please try again later.</p>
            </div>`;
        }
        
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
        if (Date.now() - time <= 24 * 60 * 60 * 1000) {
            isUnlocked = true;
        } else {
            sessionStorage.removeItem('unlocked');
            sessionStorage.removeItem('unlocked_time');
            isUnlocked = false;
        }
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
    setupRandomGame();
    setupModalRandomButton();
    setupSortDropdown();
    
    const navLogo = document.getElementById('navLogo');
    if (navLogo) {
        navLogo.addEventListener('click', () => scrollToTop(true));
    }
    
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
        const newImageUrl = game.image;
        modalHeader.style.backgroundImage = `url('${newImageUrl}')`;
        modalHeader.style.backgroundSize = 'cover';
        modalHeader.style.backgroundPosition = 'center';
        
        modalTitle.textContent = game.title;
        modalTags.innerHTML = (game.tags || []).map(t => `<span class="modal-tag">${escapeHtml(t)}</span>`).join('');
        modalSize.textContent = game.size || 'N/A';
        
        const createModalBtnLocal = (url, label, isDump = false) => {
            if (!url || url === "undefined" || url.trim() === "") return '';
            const dumpAttr = isDump ? 'true' : 'false';
            return `<button onclick="startDownloadFromModal('${url}', '${fileAuthPlaceholder}', '${bpAuthPlaceholder}', '${dlcAuthPlaceholder}', '${hPlayPlaceholder}', false, false, ${dumpAttr}, '${game.title.replace(/'/g, "\\'")}')" class="modal-btn">${label}</button>`;
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
        } else {
            dumpSection.style.display = 'none';
        }
        
        let dlcBtns = '';
        if (game.dlc_akia) dlcBtns += createModalBtnLocal(game.dlc_akia, 'AKIA');
        if (game.dlc_viki) dlcBtns += createModalBtnLocal(game.dlc_viki, 'VIKI');
        if (game.dlc_buzz) dlcBtns += createModalBtnLocal(game.dlc_buzz, 'BUZZ');
        if (game.dlc_data) dlcBtns += createModalBtnLocal(game.dlc_data, 'DATA');
        if (dlcBtns) { dlcSection.style.display = 'block'; dlcContainer.innerHTML = dlcBtns; } else { dlcSection.style.display = 'none'; }
        
        let parts = [];
        const fileAuthor = game.credits_files, bpAuthor = game.credits_backport, dlcAuthor = game.credits_dlc || game.credits_dlcs;
        if (fileAuthor && dlcAuthor && fileAuthor === dlcAuthor) parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with DLCs`);
        else { if (fileAuthor) parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files`); if (dlcAuthor) parts.push(`<b>${escapeHtml(dlcAuthor)}</b> for DLCs`); }
        if (bpAuthor) parts.push(`<b>${escapeHtml(bpAuthor)}</b> for the BackPort`);
        let creditsText = parts.length > 0 ? "Thanks to " + parts.join(", ").replace(/, ([^,]*)$/, ' and $1') : "Thanks to the community.";
        creditsContainer.innerHTML = creditsText;
        
        if (game.how_to_play) { instSection.style.display = 'block'; instText.innerHTML = game.how_to_play; } else { instSection.style.display = 'none'; }
        
        const updates = allUpdates[game.title];
        if (updates && updates.length > 0) {
            updatesSection.style.display = 'block';
            updatesList.innerHTML = updates.map(upd => { const dp = upd.date.split('-'); const formattedDate = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : upd.date; return `<div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:8px;"><div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;"><div><strong>${escapeHtml(upd.version)}</strong> <small style="opacity:0.6;">(${upd.size || 'N/A'})</small><br><small style="color:var(--cyan-neon);">Released: ${formattedDate}</small></div><div style="display:flex; gap:8px;">${upd.akia_url ? `<a href="${upd.akia_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">AKIA</a>` : ''}${upd.viki_url ? `<a href="${upd.viki_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">VIKI</a>` : ''}${upd.buzz_url ? `<a href="${upd.buzz_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">BUZZ</a>` : ''}${upd.data_url ? `<a href="${upd.data_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">DATA</a>` : ''}</div></div></div>`; }).join('');
        } else { updatesSection.style.display = 'none'; }
        
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
    
    function closeMenu() {
        if (hamburger) hamburger.classList.remove('active');
        if (panel) panel.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('menu-open');
    }
    
    function openMenu() {
        if (hamburger) hamburger.classList.add('active');
        if (panel) panel.classList.add('open');
        if (overlay) overlay.classList.add('active');
        document.body.classList.add('menu-open');
    }
    
    if (hamburger) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (panel && panel.classList.contains('open')) {
                closeMenu();
            } else {
                openMenu();
            }
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeMenu);
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            closeMenu();
            const searchOverlay = document.getElementById('searchModalOverlay');
            if (searchOverlay) {
                searchOverlay.classList.add('active');
                const searchInput = document.getElementById('searchModalInput');
                setTimeout(() => {
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                }, 100);
            }
        });
    }
    
    if (randomBtn) {
        randomBtn.addEventListener('click', () => {
            closeMenu();
            if (!allGames.length) return;
            
            const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
            let availableGames = allGames;
            
            if (selectedFW !== 99) {
                availableGames = allGames.filter(g => {
                    let gameFW = 1;
                    if (g.tags && g.tags.length > 0) {
                        let foundVersions = [];
                        g.tags.forEach(tag => {
                            const matches = tag.match(/(\d+)\.xx/gi);
                            if (matches) {
                                matches.forEach(m => {
                                    const num = parseInt(m.match(/\d+/)[0], 10);
                                    foundVersions.push(num);
                                });
                            }
                        });
                        if (foundVersions.length > 0) gameFW = Math.min(...foundVersions);
                    }
                    return gameFW <= selectedFW;
                });
            }
            
            if (availableGames.length === 0) return;
            
            const randomIndex = Math.floor(Math.random() * availableGames.length);
            const randomGame = availableGames[randomIndex];
            
            isRandomModeActive = true;
            openGameModal(randomGame, null);
        });
    }
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
    
    trigger.onclick = (e) => { 
        e.stopPropagation(); 
        optionsContainer.classList.toggle('show'); 
        mobileDropdown.classList.toggle('active');
    };
    
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
            if (searchInput && searchInput.value.trim()) {
                updateSearchResultsExternal(searchInput.value);
                performSearchOnGridExternal(searchInput.value);
            } else {
                applyFWFilterWithSort();
                currentPage = 1;
                renderGames();
                updateResultCount();
            }
        };
    });
    
    window.addEventListener('click', () => { 
        optionsContainer.classList.remove('show'); 
        mobileDropdown.classList.remove('active');
    });
}

function setupModalRandomButton() {
    const modalRandomBtn = document.getElementById('modalRandomBtn');
    if (!modalRandomBtn) return;
    
    modalRandomBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!allGames.length || isTransitioning) return;
        
        const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
        let availableGames = allGames;
        
        if (selectedFW !== 99) {
            availableGames = allGames.filter(g => {
                let gameFW = 1;
                if (g.tags && g.tags.length > 0) {
                    let foundVersions = [];
                    g.tags.forEach(tag => {
                        const matches = tag.match(/(\d+)\.xx/gi);
                        if (matches) {
                            matches.forEach(m => {
                                const num = parseInt(m.match(/\d+/)[0], 10);
                                foundVersions.push(num);
                            });
                        }
                    });
                    if (foundVersions.length > 0) gameFW = Math.min(...foundVersions);
                }
                return gameFW <= selectedFW;
            });
        }
        
        if (availableGames.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * availableGames.length);
        const randomGame = availableGames[randomIndex];
        
        isRandomModeActive = true;
        
        updateModalContentWithRipple(randomGame);
        
        const btn = modalRandomBtn;
        btn.style.transform = 'scale(0.98)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 150);
    });
}

function setupRandomGame() {
    const randomBtn = document.getElementById('navRandomBtn');
    if (!randomBtn) return;
    
    randomBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!allGames.length) return;
        
        const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
        let availableGames = allGames;
        
        if (selectedFW !== 99) {
            availableGames = allGames.filter(g => {
                let gameFW = 1;
                if (g.tags && g.tags.length > 0) {
                    let foundVersions = [];
                    g.tags.forEach(tag => {
                        const matches = tag.match(/(\d+)\.xx/gi);
                        if (matches) {
                            matches.forEach(m => {
                                const num = parseInt(m.match(/\d+/)[0], 10);
                                foundVersions.push(num);
                            });
                        }
                    });
                    if (foundVersions.length > 0) gameFW = Math.min(...foundVersions);
                }
                return gameFW <= selectedFW;
            });
        }
        
        if (availableGames.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * availableGames.length);
        const randomGame = availableGames[randomIndex];
        
        isRandomModeActive = true;
        
        openGameModal(randomGame, null);
        
        const img = randomBtn.querySelector('img');
        if (img) {
            img.style.transform = 'scale(0.9)';
            setTimeout(() => {
                img.style.transform = '';
            }, 150);
        }
    });
}

function setupDownloadModal() {
    const modal = document.getElementById('download-modal');
    const closeBtn = document.getElementById('close-download-modal');
    
    const closeModal = () => {
        modal.classList.add('hiding');
        const container = document.querySelector('#download-modal .download-modal-container');
        if (container) container.classList.add('closing');
        
        setTimeout(() => {
            modal.classList.remove('show', 'hiding');
            if (container) container.classList.remove('closing');
        }, 300);
    };
    
    if (closeBtn) {
        closeBtn.onclick = closeModal;
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function showDownloadModal(content, downloadUrl) {
    const modal = document.getElementById('download-modal');
    const bodyContainer = document.getElementById('downloadModalBody');
    const finalBtn = document.getElementById('downloadFinalBtn');
    const pwHint = document.getElementById('downloadPwHint');
    const pwValue = document.getElementById('downloadPwValue');
    
    modal.classList.remove('hiding');
    const container = document.querySelector('#download-modal .download-modal-container');
    if (container) container.classList.remove('closing');
    
    if (bodyContainer) bodyContainer.innerHTML = content;
    if (finalBtn) finalBtn.href = downloadUrl;
    if (pwHint) pwHint.style.display = 'block';
    if (pwValue) pwValue.style.display = 'none';
    
    modal.classList.add('show');
}

window.revealDownloadPassword = function() {
    const pwHint = document.getElementById('downloadPwHint');
    const pwValue = document.getElementById('downloadPwValue');
    if (pwHint) pwHint.style.display = 'none';
    if (pwValue) pwValue.style.display = 'block';
};

function setupDMCAModal() {
    const modal = document.getElementById('dmca-modal');
    const closeBtn = document.getElementById('close-dmca-modal');
    const dmcaLink = document.getElementById('dmca-link');
    const mobileDmcaBtn = document.querySelector('.mobile-menu-item.dmca');
    
    const closeModal = () => {
        modal.classList.add('hiding');
        const container = document.querySelector('#dmca-modal .dmca-modal-container');
        if (container) container.classList.add('closing');
        
        setTimeout(() => {
            modal.classList.remove('show', 'hiding');
            if (container) container.classList.remove('closing');
        }, 300);
    };
    
    if (closeBtn) {
        closeBtn.onclick = closeModal;
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    const openDMCAModal = async () => {
        try {
            const res = await fetch('DMCA.json');
            const data = await res.json();
            const bodyContainer = document.getElementById('dmcaModalBody');
            if (bodyContainer) {
                bodyContainer.innerHTML = `<div class="dmca-text">${data.content.map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>`;
            }
            modal.classList.remove('hiding');
            const container = document.querySelector('#dmca-modal .dmca-modal-container');
            if (container) container.classList.remove('closing');
            modal.classList.add('show');
        } catch(err) { 
            console.error(err);
            const bodyContainer = document.getElementById('dmcaModalBody');
            if (bodyContainer) {
                bodyContainer.innerHTML = '<div class="dmca-text"><p>Errore nel caricamento del contenuto DMCA.</p></div>';
            }
            modal.classList.add('show');
        }
    };
    
    if (dmcaLink) {
        dmcaLink.onclick = openDMCAModal;
    }
    
    if (mobileDmcaBtn) {
        const newMobileBtn = mobileDmcaBtn.cloneNode(true);
        mobileDmcaBtn.parentNode.replaceChild(newMobileBtn, mobileDmcaBtn);
        newMobileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const panel = document.getElementById('mobileMenuPanel');
            const overlay = document.getElementById('mobileMenuOverlay');
            const hamburger = document.getElementById('hamburgerBtn');
            if (panel) panel.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
            if (hamburger) hamburger.classList.remove('active');
            openDMCAModal();
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
    
    const openSearch = () => {
        overlay.classList.add('active');
        searchInput.value = '';
        updateSearchResults('');
        setTimeout(() => {
            searchInput.focus();
            searchInput.select();
        }, 50);
    };
    
    const closeSearch = () => {
        overlay.classList.remove('active');
        searchInput.value = '';
        updateSearchResults('');
        applyFWFilterWithSort();
        currentPage = 1;
        renderGames();
        updateResultCount();
        searchInput.blur();
    };
    
    if (navBtn) navBtn.addEventListener('click', openSearch);
    if (closeBtn) closeBtn.addEventListener('click', closeSearch);
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSearch();
    });
    
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            openSearch();
        }
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            e.preventDefault();
            closeSearch();
        }
        if (e.key === 'Escape' && document.getElementById('game-detail-modal').style.display === 'block') {
            document.getElementById('game-detail-modal').style.display = 'none';
            isRandomModeActive = false;
        }
    });
    
    searchInput.addEventListener('input', (e) => {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const term = e.target.value;
            updateSearchResults(term);
            performSearchOnGrid(term);
        }, 200);
    });
    
    searchInput.addEventListener('focus', () => {
        searchInput.style.animation = 'searchGlow 0.4s ease';
        setTimeout(() => { if(searchInput) searchInput.style.animation = ''; }, 400);
    });
    
    function updateSearchResults(term) {
        const lowerTerm = term.toLowerCase().trim();
        const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
        
        if (!lowerTerm) {
            resultsContainer.innerHTML = '<div class="no-results">Start typing to search for games...</div>';
            statsSpan.textContent = '0';
            return;
        }
        
        const searchResults = allGames.filter(g => {
            const matchesSearch = g.title.toLowerCase().includes(lowerTerm);
            let gameFW = 1;
            if (g.tags && g.tags.length > 0) {
                let foundVersions = [];
                g.tags.forEach(tag => {
                    const matches = tag.match(/(\d+)\.xx/gi);
                    if (matches) {
                        matches.forEach(m => {
                            const num = parseInt(m.match(/\d+/)[0], 10);
                            foundVersions.push(num);
                        });
                    }
                });
                if (foundVersions.length > 0) gameFW = Math.min(...foundVersions);
            }
            const matchesFW = gameFW <= selectedFW;
            return matchesSearch && matchesFW;
        });
        
        statsSpan.textContent = searchResults.length;
        statsSpan.style.animation = 'none';
        statsSpan.offsetHeight;
        statsSpan.style.animation = 'fadeIn 0.2s ease';
        if (searchResults.length > 0) {
            statsSpan.style.color = '#39ff14';
            setTimeout(() => { if(statsSpan) statsSpan.style.color = ''; }, 400);
        } else {
            statsSpan.style.color = '#ff0033';
            setTimeout(() => { if(statsSpan) statsSpan.style.color = ''; }, 400);
        }
        
        if (searchResults.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">😔 Nessun gioco trovato per "' + escapeHtml(lowerTerm) + '"</div>';
            return;
        }
        
        resultsContainer.innerHTML = searchResults.map(game => `
            <div class="search-result-item" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'>
                <img class="search-result-img" src="${game.image}" alt="${game.title}" loading="lazy" referrerpolicy="no-referrer">
                <div class="search-result-info">
                    <div class="search-result-title">${escapeHtml(game.title)}</div>
                    <div class="search-result-tags">
                        ${(game.tags || []).slice(0, 3).map(t => `<span class="search-result-tag">${escapeHtml(t)}</span>`).join('')}
                        ${(game.tags || []).length > 3 ? `<span class="search-result-tag">+${game.tags.length - 3}</span>` : ''}
                    </div>
                </div>
                ${game.size ? `<div class="search-result-size">${game.size}</div>` : ''}
            </div>
        `).join('');
        
        document.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameDataAttr = el.getAttribute('data-game');
                if (gameDataAttr) {
                    try {
                        const decoded = gameDataAttr.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                        const game = JSON.parse(decoded);
                        closeSearch();
                        setTimeout(() => {
                            isRandomModeActive = false;
                            openGameModal(game, e);
                        }, 300);
                    } catch(err) { console.error("Errore:", err); }
                }
            });
        });
    }
    
    function performSearchOnGrid(term) {
        const lowerTerm = term.toLowerCase().trim();
        const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
        const sortValue = document.getElementById('sort-filter').value;
        
        if (!lowerTerm) {
            applyFWFilterWithSort();
            currentPage = 1;
            renderGames();
            updateResultCount();
            scrollToTop(true);
            return;
        }
        
        const searchResults = allGames.filter(g => {
            const matchesSearch = g.title.toLowerCase().includes(lowerTerm);
            let gameFW = 1;
            if (g.tags && g.tags.length > 0) {
                let foundVersions = [];
                g.tags.forEach(tag => {
                    const matches = tag.match(/(\d+)\.xx/gi);
                    if (matches) {
                        matches.forEach(m => {
                            const num = parseInt(m.match(/\d+/)[0], 10);
                            foundVersions.push(num);
                        });
                    }
                });
                if (foundVersions.length > 0) gameFW = Math.min(...foundVersions);
            }
            const matchesFW = gameFW <= selectedFW;
            return matchesSearch && matchesFW;
        });
        
        filteredGames = sortGames(searchResults, sortValue);
        currentPage = 1;
        renderGames();
        updateResultCount();
        scrollToTop(true);
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
            
            if (isFlagged) {
                data = generateFakeGames(500);
                console.warn("[Anti-Scraper] Honeypot data served to bot");
            }
            
            allGames = data;
            allGames.forEach((game, index) => {
                originalOrderMap.set(game.title, index);
            });
        } catch (jsonError) {
            alert("🚨 ERRORE FATALE: Il tuo file exFAT.json è rotto!\nCorreggi il file JSON e ricarica la pagina.");
            hideSkeletonLoader();
            return;
        }
        
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
    } catch (e) { 
        console.error("Errore caricamento library:", e);
        hideSkeletonLoader();
    }
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
    
    const startDrag = (e) => {
        if (e.button === 2 || e.type === 'contextmenu') return;
        e.preventDefault();
        hasMoved = false;
        window._wasDrag = false;
        if (autoScrollActive) autoScrollActive = false;
        isDragging = true;
        startDragX = e.type === 'mousedown' ? e.pageX : e.touches[0].pageX;
        startDragPos = currentPosition;
        track.style.transition = 'none';
        container.style.cursor = 'grabbing';
    };
    
    const onDrag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const currentX = e.type === 'mousemove' ? e.pageX : e.touches[0].pageX;
        const diff = currentX - startDragX;
        if (Math.abs(diff) > 5) { hasMoved = true; window._wasDrag = true; }
        let newPosition = startDragPos - diff;
        const halfTrack = track.scrollWidth / 2;
        if (newPosition >= halfTrack) { newPosition -= halfTrack; startDragPos -= halfTrack; }
        else if (newPosition < 0) { newPosition += halfTrack; startDragPos += halfTrack; }
        currentPosition = newPosition;
        track.style.transform = `translateX(-${currentPosition}px)`;
    };
    
    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        track.style.transition = '';
        container.style.cursor = 'grab';
        setTimeout(() => { if (!isDragging) { autoScrollActive = true; startTime = null; window._wasDrag = false; } }, 2000);
    };
    
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
    if (!crypto || !crypto.subtle) {
        alert("⚠️ ERRORE BROWSER: Per testare la password devi caricare i file su GitHub Pages!");
        return null;
    }
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
            
            if (overlay) {
                overlay.style.transition = 'opacity 0.5s ease';
                overlay.style.opacity = '0';
                setTimeout(() => { 
                    if (overlay && overlay.parentNode) overlay.remove(); 
                    document.body.style.overflow = 'auto'; 
                    startIntegrityCheck(); 
                }, 500);
            }
        } else {
            errorMsg.style.display = 'block';
            lockBox.style.animation = 'none';
            lockBox.offsetHeight;
            lockBox.style.animation = 'shake 0.3s ease-in-out';
            document.getElementById('site-pw-input').value = '';
            setTimeout(() => {
                if (errorMsg) errorMsg.style.display = 'none';
            }, 2000);
        }
    } catch (e) { 
        console.error("Errore password:", e); 
    }
}

function startProtection() {
    if (protectionInterval) clearInterval(protectionInterval);
    protectionInterval = setInterval(() => {
        const unlocked = sessionStorage.getItem('unlocked');
        const unlockedTime = sessionStorage.getItem('unlocked_time');
        const overlay = document.getElementById('site-lock-overlay');
        
        if (!overlay && unlocked !== SECRET_HASH) {
            location.reload();
        }
        
        if (unlocked === SECRET_HASH && unlockedTime) {
            const time = parseInt(unlockedTime);
            if (Date.now() - time > 24 * 60 * 60 * 1000) {
                sessionStorage.removeItem('unlocked');
                sessionStorage.removeItem('unlocked_time');
                location.reload();
            }
        }
        
        if (overlay && unlocked === SECRET_HASH) {
            overlay.remove();
            document.body.style.overflow = 'auto';
        }
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
            if (searchInput && searchInput.value.trim()) {
                updateSearchResultsExternal(searchInput.value);
                performSearchOnGridExternal(searchInput.value);
            } else {
                applyFWFilterWithSort();
                currentPage = 1;
                renderGames();
                updateResultCount();
            }
        };
    });
    window.addEventListener('click', () => { optionsContainer.classList.remove('show'); dropdown.classList.remove('active'); });
}

function updateSearchResultsExternal(term) {
    const resultsContainer = document.getElementById('searchResultsContainer');
    const statsSpan = document.getElementById('searchModalStats');
    const lowerTerm = term.toLowerCase().trim();
    const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
    
    if (!lowerTerm) {
        if (resultsContainer) resultsContainer.innerHTML = '<div class="no-results">✨ Inizia a digitare per cercare giochi...</div>';
        if (statsSpan) statsSpan.textContent = '0';
        return;
    }
    
    const searchResults = allGames.filter(g => {
        const matchesSearch = g.title.toLowerCase().includes(lowerTerm);
        let gameFW = 1;
        if (g.tags && g.tags.length > 0) {
            let foundVersions = [];
            g.tags.forEach(tag => {
                const matches = tag.match(/(\d+)\.xx/gi);
                if (matches) {
                    matches.forEach(m => {
                        const num = parseInt(m.match(/\d+/)[0], 10);
                        foundVersions.push(num);
                    });
                }
            });
            if (foundVersions.length > 0) gameFW = Math.min(...foundVersions);
        }
        const matchesFW = gameFW <= selectedFW;
        return matchesSearch && matchesFW;
    });
    
    if (statsSpan) statsSpan.textContent = searchResults.length;
    
    if (searchResults.length === 0) {
        if (resultsContainer) resultsContainer.innerHTML = '<div class="no-results">😔 Nessun gioco trovato per "' + escapeHtml(lowerTerm) + '"</div>';
        return;
    }
    
    if (resultsContainer) {
        resultsContainer.innerHTML = searchResults.map(game => `
            <div class="search-result-item" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'>
                <img class="search-result-img" src="${game.image}" alt="${game.title}" loading="lazy" referrerpolicy="no-referrer">
                <div class="search-result-info">
                    <div class="search-result-title">${escapeHtml(game.title)}</div>
                    <div class="search-result-tags">
                        ${(game.tags || []).slice(0, 3).map(t => `<span class="search-result-tag">${escapeHtml(t)}</span>`).join('')}
                        ${(game.tags || []).length > 3 ? `<span class="search-result-tag">+${game.tags.length - 3}</span>` : ''}
                    </div>
                </div>
                ${game.size ? `<div class="search-result-size">${game.size}</div>` : ''}
            </div>
        `).join('');
        
        document.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameDataAttr = el.getAttribute('data-game');
                if (gameDataAttr) {
                    try {
                        const decoded = gameDataAttr.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                        const game = JSON.parse(decoded);
                        const overlay = document.getElementById('searchModalOverlay');
                        if (overlay) overlay.classList.remove('active');
                        setTimeout(() => {
                            isRandomModeActive = false;
                            openGameModal(game, e);
                        }, 300);
                    } catch(err) { console.error("Errore:", err); }
                }
            });
        });
    }
}

function performSearchOnGridExternal(term) {
    const lowerTerm = term.toLowerCase().trim();
    const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);
    const sortValue = document.getElementById('sort-filter').value;
    
    if (!lowerTerm) {
        applyFWFilterWithSort();
        currentPage = 1;
        renderGames();
        updateResultCount();
        scrollToTop(true);
        return;
    }
    
    const searchResults = allGames.filter(g => {
        const matchesSearch = g.title.toLowerCase().includes(lowerTerm);
        let gameFW = 1;
        if (g.tags && g.tags.length > 0) {
            let foundVersions = [];
            g.tags.forEach(tag => {
                const matches = tag.match(/(\d+)\.xx/gi);
                if (matches) {
                    matches.forEach(m => {
                        const num = parseInt(m.match(/\d+/)[0], 10);
                        foundVersions.push(num);
                    });
                }
            });
            if (foundVersions.length > 0) gameFW = Math.min(...foundVersions);
        }
        const matchesFW = gameFW <= selectedFW;
        return matchesSearch && matchesFW;
    });
    
    filteredGames = sortGames(searchResults, sortValue);
    currentPage = 1;
    renderGames();
    updateResultCount();
    scrollToTop(true);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
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
    
    const downloadsContainer = document.getElementById('modal-downloads');
    const createModalBtnLocal = (url, label, isDump = false) => {
        if (!url || url === "undefined" || url.trim() === "") return '';
        const dumpAttr = isDump ? 'true' : 'false';
        return `<button onclick="startDownloadFromModal('${url}', '${fileAuthPlaceholder}', '${bpAuthPlaceholder}', '${dlcAuthPlaceholder}', '${hPlayPlaceholder}', false, false, ${dumpAttr}, '${game.title.replace(/'/g, "\\'")}')" class="modal-btn">${label}</button>`;
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
    
    const dumpSection = document.getElementById('modal-dump-section');
    const dumpContainer = document.getElementById('modal-dump');
    let dumpHTML = '';
    const hasDump = game.dump_akia || game.dump_viki || game.dump_buzz || game.dump_data;
    if (hasDump) {
        if (game.dump_akia) dumpHTML += createModalBtnLocal(game.dump_akia, 'AKIA', true);
        if (game.dump_viki) dumpHTML += createModalBtnLocal(game.dump_viki, 'VIKI', true);
        if (game.dump_buzz) dumpHTML += createModalBtnLocal(game.dump_buzz, 'BUZZ', true);
        if (game.dump_data) dumpHTML += createModalBtnLocal(game.dump_data, 'DATA', true);
        dumpSection.style.display = 'block';
        dumpContainer.innerHTML = dumpHTML;
    } else {
        dumpSection.style.display = 'none';
    }
    
    const dlcSection = document.getElementById('modal-dlc-section');
    const dlcContainer = document.getElementById('modal-dlc');
    let dlcBtns = '';
    if (game.dlc_akia) dlcBtns += createModalBtnLocal(game.dlc_akia, 'AKIA');
    if (game.dlc_viki) dlcBtns += createModalBtnLocal(game.dlc_viki, 'VIKI');
    if (game.dlc_buzz) dlcBtns += createModalBtnLocal(game.dlc_buzz, 'BUZZ');
    if (game.dlc_data) dlcBtns += createModalBtnLocal(game.dlc_data, 'DATA');
    if (dlcBtns) { dlcSection.style.display = 'block'; dlcContainer.innerHTML = dlcBtns; } else { dlcSection.style.display = 'none'; }
    
    let parts = [];
    const fileAuthor = game.credits_files, bpAuthor = game.credits_backport, dlcAuthor = game.credits_dlc || game.credits_dlcs;
    if (fileAuthor && dlcAuthor && fileAuthor === dlcAuthor) parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with DLCs`);
    else { if (fileAuthor) parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files`); if (dlcAuthor) parts.push(`<b>${escapeHtml(dlcAuthor)}</b> for DLCs`); }
    if (bpAuthor) parts.push(`<b>${escapeHtml(bpAuthor)}</b> for the BackPort`);
    let creditsText = parts.length > 0 ? "Thanks to " + parts.join(", ").replace(/, ([^,]*)$/, ' and $1') : "Thanks to the community.";
    document.getElementById('modal-credits').innerHTML = creditsText;
    
    const instSection = document.getElementById('modal-instructions');
    if (game.how_to_play) { instSection.style.display = 'block'; document.getElementById('modal-instructions-text').innerHTML = game.how_to_play; } else { instSection.style.display = 'none'; }
    
    const updatesSection = document.getElementById('modal-updates');
    const updatesList = document.getElementById('modal-updates-list');
    const updates = allUpdates[game.title];
    if (updates && updates.length > 0) {
        updatesSection.style.display = 'block';
        updatesList.innerHTML = updates.map(upd => { const dp = upd.date.split('-'); const formattedDate = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : upd.date; return `<div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:8px;"><div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;"><div><strong>${escapeHtml(upd.version)}</strong> <small style="opacity:0.6;">(${upd.size || 'N/A'})</small><br><small style="color:var(--cyan-neon);">Released: ${formattedDate}</small></div><div style="display:flex; gap:8px;">${upd.akia_url ? `<a href="${upd.akia_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">AKIA</a>` : ''}${upd.viki_url ? `<a href="${upd.viki_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">VIKI</a>` : ''}${upd.buzz_url ? `<a href="${upd.buzz_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">BUZZ</a>` : ''}${upd.data_url ? `<a href="${upd.data_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">DATA</a>` : ''}</div></div></div>`; }).join('');
    } else { updatesSection.style.display = 'none'; }
    
    const modalRandomBtn = document.getElementById('modalRandomBtn');
    if (modalRandomBtn) {
        if (isRandomModeActive) {
            modalRandomBtn.style.display = 'flex';
        } else {
            modalRandomBtn.style.display = 'none';
        }
    }
    
    document.getElementById('game-detail-modal').style.display = 'block';
}

function startDownloadFromModal(url, fAuth, bAuth, dAuth, hPlay, isDLC = false, isDump = false, gameTitle) {
    openDL(url, fAuth, bAuth, dAuth, hPlay, isDLC, isDump, gameTitle);
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
        cachedPopularGames.forEach(game => {
            let updateBadge = '';
            const updates = allUpdates[game.title];
            if (updates && updates.length > 0) { 
                const lastUpdateDate = new Date(updates[0].date); 
                const now = new Date(); 
                const diffInHours = (now - lastUpdateDate) / (1000 * 60 * 60); 
                if (diffInHours >= 0 && diffInHours <= 24) updateBadge = `<div class="update-badge-popular">UPDATE</div>`; 
            }
            htmlContent += `<div class="popular-card" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'><div class="popular-card-bg" style="background-image: url('${game.image}')"></div><div class="popular-card-gradient"></div>${updateBadge}<div class="popular-card-content"><div class="popular-card-header"><div class="popular-game-title">${escapeHtml(game.title)}</div>${game.size ? `<div class="popular-size"> ${game.size}</div>` : ''}</div></div><div class="click-hint">✨ Click for details</div></div>`;
        });
        track.innerHTML = htmlContent + htmlContent;
        attachPopularCardEvents();
        return;
    }
    
    section.style.display = 'flex';
    const maxPopularGames = isMobile ? 10 : 20;
    let selectedGames = [...popularGames];
    
    for (let i = selectedGames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selectedGames[i], selectedGames[j]] = [selectedGames[j], selectedGames[i]];
    }
    
    selectedGames = selectedGames.slice(0, maxPopularGames);
    cachedPopularGames = selectedGames;
    cachedIsMobile = isMobile;
    
    let htmlContent = '';
    selectedGames.forEach(game => {
        let updateBadge = '';
        const updates = allUpdates[game.title];
        if (updates && updates.length > 0) { 
            const lastUpdateDate = new Date(updates[0].date); 
            const now = new Date(); 
            const diffInHours = (now - lastUpdateDate) / (1000 * 60 * 60); 
            if (diffInHours >= 0 && diffInHours <= 24) updateBadge = `<div class="update-badge-popular">UPDATE</div>`; 
        }
        htmlContent += `<div class="popular-card" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'><div class="popular-card-bg" style="background-image: url('${game.image}')"></div><div class="popular-card-gradient"></div>${updateBadge}<div class="popular-card-content"><div class="popular-card-header"><div class="popular-game-title">${escapeHtml(game.title)}</div>${game.size ? `<div class="popular-size"> ${game.size}</div>` : ''}</div></div><div class="click-hint">✨ Click for details</div></div>`;
    });
    
    track.innerHTML = htmlContent + htmlContent;
    attachPopularCardEvents();
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const wasMobile = cachedIsMobile;
        const isMobile = window.innerWidth <= 768;
        if (wasMobile !== isMobile && cachedPopularGames) {
            cachedPopularGames = null;
            renderPopularGames();
        }
    }, 250);
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
        let sizeHTML = game.size ? `<div class="game-size">${game.size}</div>` : '';
        let updateBadge = '';
        const updates = allUpdates[game.title];
        if (updates && updates.length > 0) { const lastUpdateDate = new Date(updates[0].date); const now = new Date(); const diffInHours = (now - lastUpdateDate) / (1000 * 60 * 60); if (diffInHours >= 0 && diffInHours <= 24) updateBadge = `<div class="update-badge" style="position:absolute; top:15px; left:15px; background:var(--green-neon); color:#000; padding:4px 10px; border-radius:8px; font-weight:900; font-size:0.7rem; z-index:20; box-shadow:0 0 10px var(--green-neon); animation: pulseRed 2s infinite;">UPDATE</div>`; }
        const hPlay = (game.how_to_play || "").replace(/'/g, "\\'");
        const dCredits = game.credits_dlc || game.credits_dlcs || '';
        const createBtn = (url, label, isDLC = false, isDump = false) => { 
            if (!url || url === "undefined" || url.trim() === "") return ''; 
            return `<a onclick="openDL('${url}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}', ${isDLC}, ${isDump}, '${game.title.replace(/'/g, "\\'")}')" class="btn-dl">${label}</a>`;
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
        
        grid.innerHTML += `<div class="game-card">${updateBadge}<span class="game-title">${escapeHtml(game.title)}</span><div class="image-container"><img src="${game.image}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/400x400/0a0a1a/cyan?text=No+Image'"><div class="tags-overlay">${tagsHTML}</div>${sizeHTML}</div><div class="download-section">${downloadHTML}${dumpSectionHTML}${dlcSectionHTML}</div></div>`;
    });
    const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
    document.getElementById('page-info').innerText = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

function openDL(url, fAuth, bAuth, dAuth, hPlay, isDLC = false, isDump = false, gameTitle) {
    let parts = [];
    const clean = (str) => (str && str !== "undefined" && str.trim() !== "") ? str.trim() : null;
    const fileAuthor = clean(fAuth), bpAuthor = clean(bAuth), dlcAuthor = clean(dAuth), playInstructions = clean(hPlay);
    if (fileAuthor && dlcAuthor && fileAuthor === dlcAuthor) parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files with DLCs`);
    else { if (fileAuthor) parts.push(`<b>${escapeHtml(fileAuthor)}</b> for the Files`); if (dlcAuthor) parts.push(`<b>${escapeHtml(dlcAuthor)}</b> for DLCs`); }
    if (bpAuthor) parts.push(`<b>${escapeHtml(bpAuthor)}</b> for the BackPort`);
    let creditsText = parts.length > 0 ? "Thanks to " + parts.join(", ").replace(/, ([^,]*)$/, ' and $1') : "Thanks to the community.";
    
    let updateHTML = "";
    const updates = allUpdates[gameTitle];
    if (updates && updates.length > 0) {
        updateHTML = `
            <div class="download-updates-card">
                <div class="download-updates-title">🔄 OLD RELEASES</div>
                ${updates.map(upd => { 
                    const dp = upd.date.split('-'); 
                    const formattedDate = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : upd.date; 
                    return `
                        <div class="download-update-item">
                            <div>
                                <div class="download-update-version">${escapeHtml(upd.version)}</div>
                                <div class="download-update-date">Released: ${formattedDate} (${upd.size || 'N/A'})</div>
                            </div>
                            <div class="download-update-links">
                                ${upd.akia_url ? `<a href="${upd.akia_url}" target="_blank" class="download-update-link">AKIA</a>` : ''}
                                ${upd.viki_url ? `<a href="${upd.viki_url}" target="_blank" class="download-update-link">VIKI</a>` : ''}
                                ${upd.buzz_url ? `<a href="${upd.buzz_url}" target="_blank" class="download-update-link">BUZZ</a>` : ''}
                                ${upd.data_url ? `<a href="${upd.data_url}" target="_blank" class="download-update-link">DATA</a>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    let instHTML = "";
    if (isDLC) {
        instHTML = `
            <div class="download-instruction-card">
                <div class="download-instruction-title">🎮 HOW TO UNLOCK ALL DLCS</div>
                <div class="download-instruction-text">Install the title (.exFAT) then the DLCs.${playInstructions ? `<br><br><strong>Extra Info:</strong> ${playInstructions}` : ''}</div>
            </div>
        `;
    } else if (playInstructions) {
        instHTML = `
            <div class="download-instruction-card">
                <div class="download-instruction-title">📖 INSTRUCTIONS / HOW TO PLAY</div>
                <div class="download-instruction-text">${playInstructions}</div>
            </div>
        `;
    }
    
    const modalContent = `
        <div class="download-credit-card">
            <div class="download-credit-text">${creditsText}</div>
        </div>
        ${instHTML}
        ${updateHTML}
    `;
    
    showDownloadModal(modalContent, url);
}

document.getElementById('modal-close-btn').onclick = () => { 
    document.getElementById('game-detail-modal').style.display = 'none';
    isRandomModeActive = false;
};
window.onclick = (e) => { if (e.target.classList.contains('game-modal')) { e.target.style.display = 'none'; isRandomModeActive = false; } };
window.addEventListener('DOMContentLoaded', init);
window.addEventListener('scroll', () => { const nav = document.querySelector('nav'); if (nav) { if (window.scrollY > 20) nav.classList.add('scrolled'); else nav.classList.remove('scrolled'); } });
document.getElementById('next-page').onclick = () => { currentPage++; renderGames(); scrollToTop(true); };
document.getElementById('prev-page').onclick = () => { currentPage--; renderGames(); scrollToTop(true); };
