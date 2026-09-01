// ============================================================
// 📱 MOBILE DETECTION & CACHE CLEANER
// ============================================================

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || window.innerWidth < 768;
}

function clearBotCache() {
    // Pulisce tutti i flag del bot
    const items = [
        'flagged_as_bot',
        'honeypot_clicked',
        'bot_detected'
    ];
    
    items.forEach(key => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    });
    
    console.log('✅ Cache bot pulita');
}

// Se è mobile, pulisci SUBITO
if (isMobileDevice()) {
    console.log('📱 Dispositivo mobile rilevato - pulizia cache automatica');
    clearBotCache();
}

// ============================================================
// VARIABILI GLOBALI
// ============================================================

let allGames = [];
let lastETag = null;
let cachedGames = null;
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

// ============================================================================
// Pegasus decrypt acceleration: IndexedDB persistent cache + Web Worker pool
// ============================================================================
const PEGASUS_IDB_NAME = 'pegasusDecryptCache';
const PEGASUS_IDB_STORE = 'links';
const PEGASUS_IDB_VERSION = 1;

const pegasusCacheStats = { hits: 0, idbHits: 0, misses: 0, writes: 0 };

function pegasusOpenDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { resolve(null); return; }
    let req;
    try { req = indexedDB.open(PEGASUS_IDB_NAME, PEGASUS_IDB_VERSION); }
    catch (e) { resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PEGASUS_IDB_STORE)) {
        db.createObjectStore(PEGASUS_IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function pegasusIdbGetMany(db, encUrls) {
  const out = new Map();
  if (!db || !encUrls.length) return out;
  return new Promise((resolve) => {
    let tx;
    try { tx = db.transaction(PEGASUS_IDB_STORE, 'readonly'); }
    catch (e) { resolve(out); return; }
    const store = tx.objectStore(PEGASUS_IDB_STORE);
    let pending = encUrls.length;
    for (const enc of encUrls) {
      const g = store.get(enc);
      g.onsuccess = () => { if (typeof g.result === 'string') out.set(enc, g.result); if (--pending === 0) resolve(out); };
      g.onerror = () => { if (--pending === 0) resolve(out); };
    }
    tx.onabort = () => resolve(out);
  });
}

async function pegasusIdbPutMany(db, map) {
  if (!db || !map.size) return 0;
  return new Promise((resolve) => {
    let tx;
    try { tx = db.transaction(PEGASUS_IDB_STORE, 'readwrite'); }
    catch (e) { resolve(0); return; }
    const store = tx.objectStore(PEGASUS_IDB_STORE);
    let n = 0;
    for (const [enc, plain] of map) { try { store.put(plain, enc); n++; } catch (e) {} }
    tx.oncomplete = () => resolve(n);
    tx.onerror = () => resolve(0);
    tx.onabort = () => resolve(0);
  });
}

async function pegasusIdbCount(db) {
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PEGASUS_IDB_STORE, 'readonly');
      const c = tx.objectStore(PEGASUS_IDB_STORE).count();
      c.onsuccess = () => resolve(c.result);
      c.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

async function clearPegasusDecryptCache() {
  try { pegasusDecryptCache.clear(); } catch (e) {}
  const db = await pegasusOpenDB();
  if (!db) { console.log('[pegasus] cleared in-memory cache (IndexedDB unavailable)'); return 'memory-only'; }
  const before = await pegasusIdbCount(db);
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(PEGASUS_IDB_STORE, 'readwrite');
      tx.objectStore(PEGASUS_IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch (e) { resolve(); }
  });
  try { db.close(); } catch (e) {}
  console.log(`[pegasus] cleared decrypt cache (${before != null ? before : '?'} IndexedDB entries removed)`);
  return before;
}
if (typeof window !== 'undefined') window.clearPegasusDecryptCache = clearPegasusDecryptCache;

// --- Worker source ---
const PEGASUS_WORKER_SRC = `
const LINK_LOCK_PASSWORD = "pippo";
const DEF_SALT = new Uint8Array([236,231,167,249,207,95,201,235,164,98,246,26,176,174,72,249]);
const DEF_IV = new Uint8Array([255,237,148,105,6,255,123,202,115,130,16,116]);
function b64(b){let n=b.replace(/-/g,'+').replace(/_/g,'/');const p=(4-(n.length%4))%4;n+='='.repeat(p);const s=atob(n);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
let _mat=null;
async function mat(){ if(_mat)return _mat; _mat=await crypto.subtle.importKey('raw',new TextEncoder().encode(LINK_LOCK_PASSWORD),'PBKDF2',false,['deriveKey']); return _mat; }
async function decryptOne(url){
  const parsed=new URL(url);
  const payload=b64(parsed.hash.slice(1));
  const params=JSON.parse(new TextDecoder().decode(payload));
  const encrypted=b64(params.e);
  const salt=params.s?b64(params.s):DEF_SALT;
  const iv=params.i?b64(params.i):DEF_IV;
  const km=await mat();
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},true,['decrypt']);
  const ct=encrypted.slice(0,encrypted.length-16), tag=encrypted.slice(encrypted.length-16);
  const dec=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv,tagLength:128},key,new Uint8Array([...ct,...tag]));
  return new TextDecoder().decode(dec);
}
self.onmessage=async(e)=>{
  const {id,url}=e.data;
  try{ const plain=await decryptOne(url); self.postMessage({id,url,plain}); }
  catch(err){ self.postMessage({id,url,error:err.message}); }
};
`;

let _pegasusWorkerBlobUrl = null;
function pegasusWorkerUrl() {
  if (_pegasusWorkerBlobUrl) return _pegasusWorkerBlobUrl;
  const blob = new Blob([PEGASUS_WORKER_SRC], { type: 'application/javascript' });
  _pegasusWorkerBlobUrl = URL.createObjectURL(blob);
  return _pegasusWorkerBlobUrl;
}

function pegasusPoolSize() {
  try { return Math.max(1, Math.min(8, navigator.hardwareConcurrency || 4)); } catch (e) { return 4; }
}

async function pegasusDecryptViaPool(encUrls, singleThreadDecrypt, onProgress) {
  const result = new Map();
  if (!encUrls.length) return result;

  const canWorker = (typeof Worker !== 'undefined');
  let poolSize = pegasusPoolSize();

  const runSingleThread = async () => {
    let done = 0;
    for (const enc of encUrls) {
      try { result.set(enc, await singleThreadDecrypt(enc)); } catch (e) { /* skip, don't cache failure */ }
      done++; if (onProgress) onProgress(done, 'fallback');
    }
    return result;
  };

  if (!canWorker) return runSingleThread();

  let workers = [];
  try {
    const url = pegasusWorkerUrl();
    for (let i = 0; i < poolSize; i++) workers.push(new Worker(url));
  } catch (e) {
    workers.forEach(w => { try { w.terminate(); } catch (_) {} });
    return runSingleThread();
  }

  return new Promise((resolve) => {
    let nextIndex = 0;
    let settledCount = 0;
    let settled = false;
    let aliveWorkers = workers.length;
    const inFlight = new Map();
    const unfinished = new Set();
    const total = encUrls.length;

    const sweepAndResolve = async () => {
      if (settled) return; settled = true;
      try { workers.forEach(w => { try { w.terminate(); } catch (_) {} }); } catch (_) {}
      for (const enc of encUrls) {
        if (result.has(enc)) continue;
        try { result.set(enc, await singleThreadDecrypt(enc)); } catch (e) { /* don't cache failure */ }
        settledCount++; if (onProgress) onProgress(Math.min(settledCount, total), 'sweep');
      }
      resolve(result);
    };

    const maybeDone = () => { if (settledCount >= total || aliveWorkers === 0) sweepAndResolve(); };

    const assign = (w) => {
      if (nextIndex >= encUrls.length) { inFlight.delete(w); return; }
      const enc = encUrls[nextIndex++];
      inFlight.set(w, enc);
      try { w.postMessage({ id: nextIndex - 1, url: enc }); }
      catch (e) {
        unfinished.add(enc); inFlight.delete(w); aliveWorkers = Math.max(0, aliveWorkers - 1);
        maybeDone();
      }
    };

    workers.forEach((w) => {
      w.onmessage = (e) => {
        const { plain, url } = e.data;
        if (typeof plain === 'string') result.set(url, plain);
        inFlight.delete(w);
        settledCount++;
        if (onProgress) onProgress(Math.min(settledCount, total), 'worker');
        if (settledCount >= total) { sweepAndResolve(); return; }
        assign(w);
      };
      w.onerror = () => {
        const cur = inFlight.get(w);
        if (cur && !result.has(cur)) unfinished.add(cur);
        inFlight.delete(w);
        aliveWorkers = Math.max(0, aliveWorkers - 1);
        try { w.terminate(); } catch (_) {}
        maybeDone();
      };
    });

    if (total === 0) { sweepAndResolve(); return; }

    for (let k = 0; k < workers.length; k++) assign(workers[k]);

    const watchdogMs = Math.max(30000, total * 500);
    setTimeout(() => {
      if (settled) return;
      for (const [, enc] of inFlight) if (!result.has(enc)) unfinished.add(enc);
      for (let i = nextIndex; i < encUrls.length; i++) if (!result.has(encUrls[i])) unfinished.add(encUrls[i]);
      aliveWorkers = 0;
      sweepAndResolve();
    }, watchdogMs);
  });
}


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
    }, { passive: true });
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
    if (window.PEGASUS_DEBUG) console.log('PROCESSING', title || `(item ${itemNumber})`);
    
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

    const SKIP_KEYS = new Set(['image', 'title', 'size', 'how_to_play', 'tags']);

    for (const [key, value] of Object.entries(game)) {
        if (SKIP_KEYS.has(key) || key.startsWith('credits_')) continue;
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
        else if (key.includes('ffpkg')) group = 'ffpkg';
        
        if (key.includes('akia')) mirror = 'akia';
        else if (key.includes('viki')) mirror = 'viki';
        else if (key.includes('buzz')) mirror = 'buzz';
        else if (key.includes('data')) mirror = 'data';
        else if (key.includes('filek')) mirror = 'filek';
        else if (key.includes('vault')) mirror = 'vault';
        else if (key.includes('vault')) mirror = 'filed';

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
        const reason = 'no decryptable download links';
        warnings.push(`${title} (${titleId || 'no PPSA'}): skipped — ${reason}`);
        if (window.PEGASUS_DEBUG) console.log('SKIPPED', title, '-', reason);
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
    if (window.PEGASUS_DEBUG) console.log('CREATED', title, '-', allLinks.length, 'links');
    
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

    const logProgress = (source, completed, total, percent, label) => {
        if (!window.PEGASUS_DEBUG) return;
        console.log('[pegasus:progress]', { source, completed, total, percent, label });
    };

    let _btnLabel = '0%';
    const setProgressLabel = (label) => {
        _btnLabel = label;
        convertBtn.innerHTML = `${spinnerFrames[frameIndex]} ${label}`;
    };

    const startSpinner = () => {
        animationInterval = setInterval(() => {
            if (convertBtn.disabled) {
                frameIndex = (frameIndex + 1) % spinnerFrames.length;
                convertBtn.innerHTML = `${spinnerFrames[frameIndex]} ${_btnLabel}`;
                logProgress('spinner', null, null, null, _btnLabel);
            }
        }, 100);
    };
    
    const stopSpinner = () => {
        if (animationInterval) {
            clearInterval(animationInterval);
            animationInterval = null;
        }
    };
    
    setProgressLabel('0%');
    convertBtn.disabled = true;
    convertBtn.style.background = 'linear-gradient(135deg, #ff8800, #ff5500)';
    convertBtn.style.transform = 'scale(0.98)';
    convertBtn.classList.add('converting-pulse');
    
    startSpinner();
    
    try {
        const originalDecrypt = window.PippoExfatConverter ? PippoExfatConverter.decryptLinkLockUrl : (url) => url;
        const allPackages = [];
        const warnings = [];

        if (window.PippoExfatConverter && PippoExfatConverter._resetKeyDeriveStats) {
            PippoExfatConverter._resetKeyDeriveStats();
        }
        const _t0 = performance.now();

        pegasusCacheStats.hits = 0;
        pegasusCacheStats.idbHits = 0;
        pegasusCacheStats.misses = 0;
        pegasusCacheStats.writes = 0;

        const isLL = (v) => window.PippoExfatConverter && PippoExfatConverter.isLinkLockUrl && PippoExfatConverter.isLinkLockUrl(v);

        const SKIP = new Set(['image', 'title', 'size', 'how_to_play', 'tags']);
        const distinctEnc = new Set();
        for (const game of allGames) {
            for (const [key, value] of Object.entries(game)) {
                if (SKIP.has(key) || key.startsWith('credits_')) continue;
                if (typeof value !== 'string') continue;
                if (!value.startsWith('http')) continue;
                if (isLL(value)) distinctEnc.add(value);
            }
        }
        const allEnc = [...distinctEnc];
        const totalLinks = allEnc.length;

        const needIdb = [];
        for (const enc of allEnc) {
            if (pegasusDecryptCache.has(enc)) pegasusCacheStats.hits++;
            else needIdb.push(enc);
        }

        const db = await pegasusOpenDB();
        let coldUrls = needIdb;
        if (db && needIdb.length) {
            const found = await pegasusIdbGetMany(db, needIdb);
            coldUrls = [];
            for (const enc of needIdb) {
                if (found.has(enc)) { pegasusDecryptCache.set(enc, found.get(enc)); pegasusCacheStats.idbHits++; }
                else coldUrls.push(enc);
            }
        }
        pegasusCacheStats.misses = coldUrls.length;

        let _workerCount = 0;
        if (coldUrls.length) {
            _workerCount = (typeof Worker !== 'undefined') ? pegasusPoolSize() : 0;
            setProgressLabel(`0/${coldUrls.length}`);
            const singleThread = (url) => originalDecrypt(url);
            let _coldLastPct = -1;
            const newlyDecrypted = await pegasusDecryptViaPool(coldUrls, singleThread, (done, src) => {
                const safeDone = Math.min(done, coldUrls.length);
                const pct = Math.min(100, Math.round((safeDone / coldUrls.length) * 100));
                logProgress(src || 'cold-decrypt', safeDone, coldUrls.length, pct, `${safeDone}/${coldUrls.length} (${pct}%)`);
                if (pct !== _coldLastPct) {
                    _coldLastPct = pct;
                    setProgressLabel(`${safeDone}/${coldUrls.length} (${pct}%)`);
                }
            });
            const toPersist = new Map();
            for (const [enc, plain] of newlyDecrypted) {
                pegasusDecryptCache.set(enc, plain);
                toPersist.set(enc, plain);
            }
            if (db && toPersist.size) {
                pegasusCacheStats.writes = await pegasusIdbPutMany(db, toPersist);
            }
        }

        const idbSize = await pegasusIdbCount(db);
        const _tResolve = performance.now();
        console.log(
            `[pegasus] resolve: ${(_tResolve - _t0).toFixed(0)}ms | ` +
            `links: ${totalLinks} | mem hits: ${pegasusCacheStats.hits} | ` +
            `idb hits: ${pegasusCacheStats.idbHits} | cold decrypts: ${pegasusCacheStats.misses} | ` +
            `idb writes: ${pegasusCacheStats.writes} | workers: ${_workerCount}` +
            (idbSize != null ? ` | idb size: ${idbSize}` : '')
        );
        if (db) { try { db.close(); } catch (e) {} }

        let _lastPercent = -1;

        for (let i = 0; i < allGames.length; i++) {
            const game = allGames[i];
            const current = i + 1;
            const percent = Math.min(100, Math.round((current / totalGames) * 100));
            if (percent !== _lastPercent) {
                _lastPercent = percent;
                setProgressLabel(`${percent}%`);
                logProgress('package-build', current, totalGames, percent, `${percent}%`);
            }
            const result = await convertSingleGame(game, current, warnings, originalDecrypt);
            allPackages.push(...result);
        }

        const _tBuild = performance.now();

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

        const _tJson = performance.now();

        const _decryptedUrls = pegasusDecryptCache.size;
        const _keyStats = (window.PippoExfatConverter && PippoExfatConverter._getKeyDeriveStats)
            ? PippoExfatConverter._getKeyDeriveStats()
            : { derivations: 'n/a', hits: 'n/a', misses: 'n/a', distinctSalts: 'n/a' };
        console.log(
            `[pegasus] total: ${(_tJson - _t0).toFixed(0)}ms | ` +
            `resolve(decrypt): ${(_tResolve - _t0).toFixed(0)}ms | ` +
            `build: ${(_tBuild - _tResolve).toFixed(0)}ms | ` +
            `stringify+blob: ${(_tJson - _tBuild).toFixed(0)}ms`
        );
        console.log(
            `[pegasus] cache -> mem hits: ${pegasusCacheStats.hits}, ` +
            `idb hits: ${pegasusCacheStats.idbHits}, cold decrypts: ${pegasusCacheStats.misses}, ` +
            `idb writes: ${pegasusCacheStats.writes}`
        );
        console.log(
            `[pegasus] PBKDF2 derivations: ${_keyStats.derivations} ` +
            `(key-cache hits: ${_keyStats.hits}, misses: ${_keyStats.misses}, distinct salts: ${_keyStats.distinctSalts}) | ` +
            `decrypted URLs in memory: ${_decryptedUrls} | packages: ${allPackages.length} | warnings: ${warnings.length}`
        );
        if (warnings.length) {
            console.warn(`[pegasus] ${warnings.length} warning(s) — entries below were skipped or had problems:`);
            warnings.forEach(w => console.warn('  • ' + w));
        }

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
        const timestamp = Date.now();
        const manifestRes = await fetch('ampr-emu-drakmor/manifest.json?v=' + timestamp);
        if (manifestRes.ok) {
            const manifest = await manifestRes.json();
            if (manifest.files && Array.isArray(manifest.files)) {
                console.log('APR-EMU files loaded from manifest:', manifest.files);
                cachedAprEmuFiles = manifest.files;
                return cachedAprEmuFiles;
            }
        }
        
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
    const footerDiv = document.querySelector('#download-modal .download-modal-container > div:last-child');
    
    modal.classList.remove('hiding');
    const container = document.querySelector('#download-modal .download-modal-container');
    if (container) container.classList.remove('closing');
    
    // RESETTA IL FOOTER ALLO STATO ORIGINALE
    if (footerDiv) {
        footerDiv.innerHTML = `
            <a id="downloadFinalBtn" target="_blank" class="download-final-btn">DOWNLOAD</a>
        `;
    }
    
    // Ricarica i riferimenti dopo il reset
    const newPasswordBox = document.getElementById('downloadPasswordBox');
    const newFinalBtn = document.getElementById('downloadFinalBtn');
    const newPwHint = document.getElementById('downloadPwHint');
    const newPwValue = document.getElementById('downloadPwValue');
    
    if (newPasswordBox) newPasswordBox.style.display = 'block';
    if (newFinalBtn) newFinalBtn.style.display = 'block';
    if (newPwHint) newPwHint.style.display = 'block';
    if (newPwValue) newPwValue.style.display = 'none';
    
    if (bodyContainer) bodyContainer.innerHTML = content;
    if (newFinalBtn) newFinalBtn.href = downloadUrl;
    
    modal.classList.add('show');
}

function showAprEmuDownloadModal(content, downloadUrl) {
    const modal = document.getElementById('download-modal');
    const bodyContainer = document.getElementById('downloadModalBody');
    const footerDiv = document.querySelector('#download-modal .download-modal-container > div:last-child');
    
    modal.classList.remove('hiding');
    const container = document.querySelector('#download-modal .download-modal-container');
    if (container) container.classList.remove('closing');
    
    if (bodyContainer) bodyContainer.innerHTML = content;
    
    // RESETTA IL FOOTER CON I BOTTONI APR-EMU
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
        `;
        
        // Aggiungi l'effetto shine
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
        updateHTML = `<div class="download-updates-card"><div class="download-updates-title">🔄 OLD RELEASES</div>${updates.map(upd => { const dp = upd.date.split('-'); const formattedDate = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : upd.date; return `<div class="download-update-item"><div><div class="download-update-version">${escapeHtml(upd.version)}</div><div class="download-update-date">Released: ${formattedDate} (${upd.size || 'N/A'})</div></div><div class="download-update-links">${upd.akia_url ? `<a href="${upd.akia_url}" target="_blank" class="download-update-link">AKIA</a>` : ''}${upd.viki_url ? `<a href="${upd.viki_url}" target="_blank" class="download-update-link">VIKI</a>` : ''}${upd.buzz_url ? `<a href="${upd.buzz_url}" target="_blank" class="download-update-link">BUZZ</a>` : ''}${upd.data_url ? `<a href="${upd.data_url}" target="_blank" class="download-update-link">DATA</a>` : ''}${upd.filek_url ? `<a href="${upd.filek_url}" target="_blank" class="download-update-link">FILEK</a>` : ''}${upd.vault_url ? `<a href="${upd.vault_url}" target="_blank" class="download-update-link">VAULT</a>` : ''}</div></div>`; }).join('')}</div>`;
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

// ========== FUNZIONE PER PULIRE IL BADGE APR-EMU ==========
function clearAprEmuBadge() {
    const badge = document.getElementById('modal-apr-emu-badge');
    if (badge) {
        badge.innerHTML = '';
        badge.style.display = 'none';
    }
}

// ========== FUNZIONE PER APRIRE IL MODAL FIX ==========
function openFixModal(url, fixGuide, gameTitle) {
    const modal = document.getElementById('download-modal');
    const bodyContainer = document.getElementById('downloadModalBody');
    const footerDiv = document.querySelector('#download-modal .download-modal-container > div:last-child');
    const pwBox = document.getElementById('downloadPasswordBox');
    const pwHint = document.getElementById('downloadPwHint');
    const pwValue = document.getElementById('downloadPwValue');
    const finalBtn = document.getElementById('downloadFinalBtn');
    
    modal.classList.remove('hiding');
    const container = document.querySelector('#download-modal .download-modal-container');
    if (container) container.classList.remove('closing');
    
    // Nascondi la password box (non serve per i fix)
    if (pwBox) pwBox.style.display = 'none';
    if (pwHint) pwHint.style.display = 'none';
    if (pwValue) pwValue.style.display = 'none';
    
    // Costruisci il contenuto del modale
    // Formatta il fixGuide per avere ogni step su una nuova riga
    // Formatta il fixGuide per avere ogni step su una nuova riga
    let formattedGuide = '';
    if (fixGuide && fixGuide.trim() !== '') {
        // Gestisci sia il formato "1." che "1:" 
        formattedGuide = fixGuide.replace(/(\d+[\.:])\s*/g, '<br>$1 ');
        // Rimuovi il primo <br> all'inizio se presente
        formattedGuide = formattedGuide.replace(/^<br>/, '');
        // Sostituisci eventuali ':' con '.' per uniformare
        formattedGuide = formattedGuide.replace(/(\d+):/g, '$1.');
    } else {
        formattedGuide = 'No specific instructions provided for this fix.';
    }
    
    // Costruisci il contenuto del modale
    let contentHTML = `
        <div class="download-fix-card" style="background:rgba(255, 200, 0, 0.08); border-radius:20px; padding:18px; margin-bottom:18px; border-left:3px solid #ffcc00;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                <span style="font-size:1.5rem;">🔧</span>
                <span style="font-weight:900; font-size:1rem; color:#ffcc00;">How to apply Fix</span>
            </div>
            <div style="font-size:0.85rem; line-height:1.8; color:#ddd;">
                ${formattedGuide}
            </div>
        </div>
    `;

    if (bodyContainer) bodyContainer.innerHTML = contentHTML;
    
    // RESETTA IL FOOTER CON I BOTTONI
    if (footerDiv) {
        footerDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <a href="${url}" target="_blank" class="download-final-btn" style="background: linear-gradient(135deg, #ffcc00, #ff8800); border: none; color: #000; padding: 14px 20px; border-radius: 50px; font-weight: 900; font-size: 0.9rem; cursor: pointer; width: 100%; text-align: center; text-decoration: none; display: inline-block; position: relative; overflow: hidden; box-sizing: border-box; animation: none;">
                    DOWNLOAD FIX
                </a>
            </div>
        `;
        
        // Aggiungi l'effetto shine
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
        
        const downloadLink = footerDiv.querySelector('.download-final-btn');
        if (downloadLink) {
            const shine = document.createElement('span');
            shine.className = 'shine-effect';
            downloadLink.appendChild(shine);
        }
    }
    
    modal.classList.add('show');
}

// ========== FUNZIONE UNIFICATA PER APRIRE IL MODAL ==========
function openGameModal(game, event) {
    if (event && event.button === 2) { event.preventDefault(); return false; }
    if (hasMoved || window._wasDrag) { hasMoved = false; window._wasDrag = false; return false; }
    hasMoved = false; window._wasDrag = false;
    
    // Aggiorna le variabili globali
    gameTitlePlaceholder = game.title.replace(/'/g, "\\'");
    fileAuthPlaceholder = game.credits_files || '';
    bpAuthPlaceholder = game.credits_backport || '';
    dlcAuthPlaceholder = game.credits_dlc || game.credits_dlcs || '';
    hPlayPlaceholder = (game.how_to_play || "").replace(/'/g, "\\'");
    
    // Pulisci il badge APR-EMU
    clearAprEmuBadge();
    
    // Imposta l'header del modal
    const modalHeader = document.getElementById('modal-header');
    modalHeader.style.backgroundImage = `url('${game.image}')`;
    modalHeader.style.backgroundSize = 'cover';
    modalHeader.style.backgroundPosition = 'center';
    
    // Imposta titolo, tags e size
    document.getElementById('modal-title').textContent = game.title;
    document.getElementById('modal-tags').innerHTML = (game.tags || []).map(t => `<span class="modal-tag">${escapeHtml(t)}</span>`).join('');
    document.getElementById('modal-size').textContent = game.size || 'N/A';

    // ===== GESTIONE APR-EMU =====
    const aprEmuBadge = document.getElementById('modal-apr-emu-badge');
    const requireAprEmu = (game.apr_emu === "on" || game.apr_emu === true || game.apr_emu === "true");
    
    // Pulisci il badge
    aprEmuBadge.innerHTML = '';
    aprEmuBadge.style.display = 'none';
    
    if (requireAprEmu) {
        const badgeDiv = document.createElement('div');
        badgeDiv.className = 'modal-apr-emu';
        badgeDiv.textContent = 'APR-EMU';
        
        const btn = document.createElement('button');
        btn.className = 'apr-emu-update-btn';
        btn.textContent = '⚠️ Need APR-EMU update? Check here';
        btn.onclick = function(e) {
            e.stopPropagation();
            openAprEmuModal();
        };
        
        aprEmuBadge.appendChild(badgeDiv);
        aprEmuBadge.appendChild(btn);
        aprEmuBadge.style.display = 'block';
    }

    // ===== GENERAZIONE BOTTONI DOWNLOAD =====
    const downloadsContainer = document.getElementById('modal-downloads');
    
    // Funzione per creare un bottone download nel modal
    const createModalBtn = (url, label, isDump = false) => {
        if (!url || url === "undefined" || url.trim() === "") return '';
        const dumpAttr = isDump ? 'true' : 'false';
        const isDLC = false;
        const safeTitle = game.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `<button onclick="startDownloadFromModal('${url}', '${fileAuthPlaceholder}', '${bpAuthPlaceholder}', '${dlcAuthPlaceholder}', '${hPlayPlaceholder}', ${isDLC}, ${dumpAttr}, '${safeTitle}', ${requireAprEmu})" class="modal-btn">${label}</button>`;
    };
    
    let downloadsHTML = '';
    let ffpkgHTML = '';
    
    // ===== FFPKG (usa createModalBtn identico agli altri) =====
    if (game.ffpkg_akia) ffpkgHTML += createModalBtn(game.ffpkg_akia, 'AKIA', false);
    if (game.ffpkg_viki) ffpkgHTML += createModalBtn(game.ffpkg_viki, 'VIKI', false);
    if (game.ffpkg_buzz) ffpkgHTML += createModalBtn(game.ffpkg_buzz, 'BUZZ', false);
    if (game.ffpkg_data) ffpkgHTML += createModalBtn(game.ffpkg_data, 'DATA', false);
    if (game.ffpkg_filek) ffpkgHTML += createModalBtn(game.ffpkg_filek, 'FILEK', false);
    if (game.ffpkg_vault) ffpkgHTML += createModalBtn(game.ffpkg_vault, 'VAULT', false);
    if (game.ffpkg_filed) ffpkgHTML += createModalBtn(game.ffpkg_vault, 'FILED', false);

    
    let ffpkgSectionHTML = ffpkgHTML ? `<div style="width:100%; margin-bottom:10px;"><strong>FFPKG</strong></div>${ffpkgHTML}` : '';
    
    // Verifica se ci sono backport 7.xx o 4.xx
    const hasBackport7 = game.backport7xx_akia || game.backport7xx_viki || game.backport7xx_buzz || game.backport7xx_data || game.backport7xx_filek || game.backport7xx_vault;
    const hasBackport4 = game.backport4xx_akia || game.backport4xx_viki || game.backport4xx_buzz || game.backport4xx_data || game.backport4xx_filek || game.backport4xx_vault;
    
    if (hasBackport7 || hasBackport4) {
        let bp7 = '', bp4 = '';
        if (hasBackport7) {
            if (game.backport7xx_akia) bp7 += createModalBtn(game.backport7xx_akia, 'AKIA');
            if (game.backport7xx_viki) bp7 += createModalBtn(game.backport7xx_viki, 'VIKI');
            if (game.backport7xx_buzz) bp7 += createModalBtn(game.backport7xx_buzz, 'BUZZ');
            if (game.backport7xx_data) bp7 += createModalBtn(game.backport7xx_data, 'DATA');
            if (game.backport7xx_filek) bp7 += createModalBtn(game.backport7xx_filek, 'FILEK');
            if (game.backport7xx_vault) bp7 += createModalBtn(game.backport7xx_vault, 'VAULT');
            if (game.backport7xx_filed) bp7 += createModalBtn(game.backport7xx_vault, 'FILED');
        }
        if (hasBackport4) {
            if (game.backport4xx_akia) bp4 += createModalBtn(game.backport4xx_akia, 'AKIA');
            if (game.backport4xx_viki) bp4 += createModalBtn(game.backport4xx_viki, 'VIKI');
            if (game.backport4xx_buzz) bp4 += createModalBtn(game.backport4xx_buzz, 'BUZZ');
            if (game.backport4xx_data) bp4 += createModalBtn(game.backport4xx_data, 'DATA');
            if (game.backport4xx_filek) bp4 += createModalBtn(game.backport4xx_filek, 'FILEK');
            if (game.backport4xx_vault) bp4 += createModalBtn(game.backport4xx_vault, 'VAULT');
            if (game.backport4xx_filed) bp4 += createModalBtn(game.backport4xx_vault, 'FILED');
        }
        downloadsHTML = `${ffpkgSectionHTML}${bp7 ? `<div style="width:100%; margin-bottom:10px;"><strong>Backport 7.xx</strong></div>${bp7}` : ''}${bp4 ? `<div style="width:100%; margin-bottom:10px; margin-top:10px;"><strong>Backport 4.xx</strong></div>${bp4}` : ''}`;
    } 
    // Verifica se ci sono standard e backport
    else if (game.standard_akia || game.standard_viki || game.standard_buzz || game.standard_data || game.standard_filek || game.standard_vault || 
             game.backport_akia || game.backport_viki || game.backport_buzz || game.backport_data || game.backport_filek || game.backport_vault) {
        let std = '', bp = '';
        if (game.standard_akia) std += createModalBtn(game.standard_akia, 'AKIA');
        if (game.standard_viki) std += createModalBtn(game.standard_viki, 'VIKI');
        if (game.standard_buzz) std += createModalBtn(game.standard_buzz, 'BUZZ');
        if (game.standard_data) std += createModalBtn(game.standard_data, 'DATA');
        if (game.standard_filek) std += createModalBtn(game.standard_filek, 'FILEK');
        if (game.standard_vault) std += createModalBtn(game.standard_vault, 'VAULT');
        if (game.backport_akia) bp += createModalBtn(game.backport_akia, 'AKIA');
        if (game.backport_viki) bp += createModalBtn(game.backport_viki, 'VIKI');
        if (game.backport_buzz) bp += createModalBtn(game.backport_buzz, 'BUZZ');
        if (game.backport_data) bp += createModalBtn(game.backport_data, 'DATA');
        if (game.backport_filek) bp += createModalBtn(game.backport_filek, 'FILEK');
        if (game.backport_vault) bp += createModalBtn(game.backport_vault, 'VAULT');
        if (game.backport_filed) bp += createModalBtn(game.backport_filed, 'FILED');
        downloadsHTML = `${ffpkgSectionHTML}${std ? `<div style="width:100%; margin-bottom:10px;"><strong>STANDARD</strong></div>${std}` : ''}${bp ? `<div style="width:100%; margin-bottom:10px; margin-top:10px;"><strong>BACKPORT</strong></div>${bp}` : ''}`;
    } 
    // Altrimenti usa i link standard
    else {
        let btns = '';
        if (game.akia_url) btns += createModalBtn(game.akia_url, 'AKIA');
        if (game.viki_url) btns += createModalBtn(game.viki_url, 'VIKI');
        if (game.buzz_url) btns += createModalBtn(game.buzz_url, 'BUZZ');
        if (game.data_url) btns += createModalBtn(game.data_url, 'DATA');
        if (game.filek_url) btns += createModalBtn(game.filek_url, 'FILEK');
        if (game.vault_url) btns += createModalBtn(game.vault_url, 'VAULT');
        if (game.filed_url) btns += createModalBtn(game.filed_url, 'FILED');
        downloadsHTML = `${ffpkgSectionHTML}${btns}`;
    }
    downloadsContainer.innerHTML = downloadsHTML;

    // ===== DUMP =====
    const dumpSection = document.getElementById('modal-dump-section');
    const dumpContainer = document.getElementById('modal-dump');
    let dumpHTML = '';
    const hasDump = game.dump_akia || game.dump_viki || game.dump_buzz || game.dump_data || game.dump_filek || game.dump_vault;
    if (hasDump) {
        const dumpBtn = (url, label) => {
            if (!url || url === "undefined" || url.trim() === "") return '';
            return createModalBtn(url, label, true);
        };
        if (game.dump_akia) dumpHTML += dumpBtn(game.dump_akia, 'AKIA');
        if (game.dump_viki) dumpHTML += dumpBtn(game.dump_viki, 'VIKI');
        if (game.dump_buzz) dumpHTML += dumpBtn(game.dump_buzz, 'BUZZ');
        if (game.dump_data) dumpHTML += dumpBtn(game.dump_data, 'DATA');
        if (game.dump_filek) dumpHTML += dumpBtn(game.dump_filek, 'FILEK');
        if (game.dump_vault) dumpHTML += dumpBtn(game.dump_vault, 'VAULT');
        if (game.filed_filed) dumpHTML += dumpBtn(game.dump_filed, 'FILED');
        dumpSection.style.display = 'block';
        dumpContainer.innerHTML = dumpHTML;
    } else {
        dumpSection.style.display = 'none';
    }

    // ===== DLC =====
    const dlcSection = document.getElementById('modal-dlc-section');
    const dlcContainer = document.getElementById('modal-dlc');
    let dlcBtns = '';
    if (game.dlc_akia) dlcBtns += createModalBtn(game.dlc_akia, 'AKIA');
    if (game.dlc_viki) dlcBtns += createModalBtn(game.dlc_viki, 'VIKI');
    if (game.dlc_buzz) dlcBtns += createModalBtn(game.dlc_buzz, 'BUZZ');
    if (game.dlc_data) dlcBtns += createModalBtn(game.dlc_data, 'DATA');
    if (game.dlc_filek) dlcBtns += createModalBtn(game.dlc_filek, 'FILEK');
    if (game.dlc_vault) dlcBtns += createModalBtn(game.dlc_vault, 'VAULT');
    if (game.dlc_filed) dlcBtns += createModalBtn(game.dlc_filed, 'FILED');
    if (dlcBtns) {
        dlcSection.style.display = 'block';
        dlcContainer.innerHTML = dlcBtns;
    } else {
        dlcSection.style.display = 'none';
    }

    // ===== FIX (nel modal dettaglio) =====
    const fixSection = document.getElementById('modal-fix-section');
    const fixContainer = document.getElementById('modal-fix');
    const fixGuide = (game.fix_guide || "").replace(/'/g, "\\'");
    let fixBtns = '';

    const createFixModalBtn = (url, label) => {
        if (!url || url === "undefined" || url.trim() === "") return '';
        const safeTitle = game.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `<button onclick="openFixModal('${url}', '${fixGuide}', '${safeTitle}')" class="modal-btn">${label}</button>`;
    };

    if (game.fix_akia) fixBtns += createFixModalBtn(game.fix_akia, 'AKIA');
    if (game.fix_viki) fixBtns += createFixModalBtn(game.fix_viki, 'VIKI');
    if (game.fix_buzz) fixBtns += createFixModalBtn(game.fix_buzz, 'BUZZ');
    if (game.fix_data) fixBtns += createFixModalBtn(game.fix_data, 'DATA');
    if (game.fix_filek) fixBtns += createFixModalBtn(game.fix_filek, 'FILEK');
    if (game.fix_vault) fixBtns += createFixModalBtn(game.fix_vault, 'VAULT');
    if (game.fix_filed) fixBtns += createFixModalBtn(game.fix_filed, 'FILED');

    if (fixBtns) {
        if (fixSection && fixContainer) {
            fixSection.style.display = 'block';
            fixContainer.innerHTML = fixBtns;
        }
    } else {
        if (fixSection) fixSection.style.display = 'none';
    }

// ========== FUNZIONE PER APRIRE IL MODAL FIX ==========
function openFixModal(url, fixGuide, gameTitle) {
    const modal = document.getElementById('download-modal');
    const bodyContainer = document.getElementById('downloadModalBody');
    const footerDiv = document.querySelector('#download-modal .download-modal-container > div:last-child');
    const pwBox = document.getElementById('downloadPasswordBox');
    const pwHint = document.getElementById('downloadPwHint');
    const pwValue = document.getElementById('downloadPwValue');
    const finalBtn = document.getElementById('downloadFinalBtn');
    
    modal.classList.remove('hiding');
    const container = document.querySelector('#download-modal .download-modal-container');
    if (container) container.classList.remove('closing');
    
    // Nascondi la password box (non serve per i fix)
    if (pwBox) pwBox.style.display = 'none';
    if (pwHint) pwHint.style.display = 'none';
    if (pwValue) pwValue.style.display = 'none';
    
    // Formatta il fixGuide per avere ogni step su una nuova riga
    let formattedGuide = '';
    if (fixGuide && fixGuide.trim() !== '') {
        // Sostituisci i numeri con step (1., 2., 3., ecc.) in modo che siano su nuove righe
        formattedGuide = fixGuide.replace(/(\d+\.)/g, '<br>$1');
        // Rimuovi il primo <br> all'inizio se presente
        formattedGuide = formattedGuide.replace(/^<br>/, '');
    } else {
        formattedGuide = 'No specific instructions provided for this fix.';
    }
    
    // Costruisci il contenuto del modale
    let contentHTML = `
        <div class="download-fix-card" style="background:rgba(255, 200, 0, 0.08); border-radius:20px; padding:18px; margin-bottom:18px; border-left:3px solid #ffcc00;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                <span style="font-size:1.5rem;">🔧</span>
                <span style="font-weight:900; font-size:1rem; color:#ffcc00;">HOW TO APPLY FIX</span>
            </div>
            <div style="font-size:0.85rem; line-height:1.8; color:#ddd;">
                ${formattedGuide}
            </div>
        </div>
    `;
    
    if (bodyContainer) bodyContainer.innerHTML = contentHTML;
    
    // RESETTA IL FOOTER CON I BOTTONI
    if (footerDiv) {
        footerDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <a href="${url}" target="_blank" class="download-final-btn" style="background: linear-gradient(135deg, #ffcc00, #ff8800); border: none; color: #000; padding: 14px 20px; border-radius: 50px; font-weight: 900; font-size: 0.9rem; cursor: pointer; width: 100%; text-align: center; text-decoration: none; display: inline-block; position: relative; overflow: hidden; box-sizing: border-box; animation: none;">
                    DOWNLOAD FIX
                </a>
            </div>
        `;
        
        // Aggiungi l'effetto shine
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
        
        const downloadLink = footerDiv.querySelector('.download-final-btn');
        if (downloadLink) {
            const shine = document.createElement('span');
            shine.className = 'shine-effect';
            downloadLink.appendChild(shine);
        }
    }
    
    modal.classList.add('show');
}

    // ===== CREDITS =====
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

    // ===== INSTRUCTIONS =====
    const instSection = document.getElementById('modal-instructions');
    if (game.how_to_play) {
        instSection.style.display = 'block';
        document.getElementById('modal-instructions-text').innerHTML = game.how_to_play;
    } else {
        instSection.style.display = 'none';
    }

    // ===== UPDATES =====
    const updatesSection = document.getElementById('modal-updates');
    const updatesList = document.getElementById('modal-updates-list');
    const updates = allUpdates[game.title];
    if (updates && updates.length > 0) {
        updatesSection.style.display = 'block';
        updatesList.innerHTML = updates.map(upd => {
            const dp = upd.date.split('-');
            const formattedDate = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : upd.date;
            return `<div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                        <strong>${escapeHtml(upd.version)}</strong> <small style="opacity:0.6;">(${upd.size || 'N/A'})</small>
                        <br><small style="color:var(--cyan-neon);">Released: ${formattedDate}</small>
                    </div>
                    <div style="display:flex; gap:8px;">
                        ${upd.akia_url ? `<a href="${upd.akia_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">AKIA</a>` : ''}
                        ${upd.viki_url ? `<a href="${upd.viki_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">VIKI</a>` : ''}
                        ${upd.buzz_url ? `<a href="${upd.buzz_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">BUZZ</a>` : ''}
                        ${upd.data_url ? `<a href="${upd.data_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">DATA</a>` : ''}
                        ${upd.filek_url ? `<a href="${upd.filek_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">FILEK</a>` : ''}
                        ${upd.vault_url ? `<a href="${upd.vault_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">VAULT</a>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    } else {
        updatesSection.style.display = 'none';
    }

    // ===== RANDOM BUTTON =====
    const modalRandomBtn = document.getElementById('modalRandomBtn');
    if (modalRandomBtn) {
        modalRandomBtn.style.display = isRandomModeActive ? 'flex' : 'none';
    }

    // Mostra il modal
    document.getElementById('game-detail-modal').style.display = 'block';
}

// ========== FUNZIONE UPDATE MODAL (per il random) ==========
function updateModalContentWithRipple(game) {
    // Usa la stessa funzione openGameModal per mantenere consistenza
    openGameModal(game, null);
}

// ========== INIT ==========

async function init() {
    // 📱 PULISCI CACHE SU MOBILE (forzato)
    if (isMobileDevice()) {
        console.log('📱 Dispositivo mobile - pulizia cache forzata');
        sessionStorage.removeItem('flagged_as_bot');
        sessionStorage.removeItem('honeypot_clicked');
        localStorage.removeItem('bot_detected');
        sessionStorage.removeItem('bot_detected');
        localStorage.removeItem('flagged_as_bot');
    }
    
    // ===== INIZIALIZZA LA MODALITÀ DI CARICAMENTO =====
    const mode = getLibraryMode();
    console.log(`[LIBRARY] Modalità di caricamento: ${mode.toUpperCase()}`);
    
    // Mostra l'indicatore (solo su desktop)
    showLibraryModeIndicator();
    
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
        openGameModal(randomGame, null);
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
                                <p>${section.answer}</p>
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
        // ===== LEGGI LA MODALITÀ DAL localStorage =====
        const USE_LOCAL = (getLibraryMode() === 'local');
        console.log(`[LIBRARY] Modalità: ${USE_LOCAL ? '📁 LOCALE' : '🌐 API'}`);
        
        const isFlagged = false; // ⚠️ IMPORTANTE: anti-bot disabilitato
        let data = null;
        
        // ===== CARICAMENTO DA FILE LOCALE =====
        if (USE_LOCAL) {
            console.log('[LIBRARY] 📁 Tentativo caricamento da file locale...');
            try {
                const localResponse = await fetch('exFAT.json?v=' + Date.now());
                if (!localResponse.ok) throw new Error(`HTTP ${localResponse.status}`);
                data = await localResponse.json();
                console.log('[LIBRARY] ✅ File locale caricato con successo');
            } catch (localError) {
                console.error('[LIBRARY] ❌ Errore caricamento locale:', localError);
                console.log('[LIBRARY] 🔄 Fallback all\'API GitHub...');
                // Se fallisce il locale, usa l'API
                data = await loadFromApi();
            }
        } else {
            // ===== CARICAMENTO DA API =====
            data = await loadFromApi();
        }
        
        // ===== VALIDAZIONE DATI =====
        if (!Array.isArray(data)) {
            console.error('[LIBRARY] exFAT.json non è un array!', typeof data);
            if (isFlagged) {
                data = generateFakeGames(500);
            } else {
                throw new Error('Il file exFAT.json deve contenere un array di giochi');
            }
        }
        
        if (isFlagged) {
            data = generateFakeGames(500);
            console.log('[LIBRARY] Modalità bot attiva - generati 500 fake games');
        }
        
        // SALVA IN CACHE
        cachedGames = data;
        allGames = data;
        allGames.forEach((game, index) => { 
            originalOrderMap.set(game.title, index); 
        });
        
        console.log('[LIBRARY] Caricati', allGames.length, 'giochi');
        
        // RESETTA I FILTRI
        const fwFilter = document.getElementById('fw-filter');
        const fwCurrent = document.getElementById('fw-current');
        if (fwFilter) fwFilter.value = '99';
        if (fwCurrent) fwCurrent.innerText = 'FW: All';
        
        const mobileFwFilter = document.getElementById('mobile-fw-filter');
        const mobileFwCurrent = document.getElementById('mobile-fw-current');
        if (mobileFwFilter) mobileFwFilter.value = '99';
        if (mobileFwCurrent) mobileFwCurrent.innerText = 'FW: All';
        
        const sortFilter = document.getElementById('sort-filter');
        const sortCurrent = document.getElementById('sort-current');
        if (sortFilter) sortFilter.value = 'default';
        if (sortCurrent) sortCurrent.innerText = 'Sort: Default';
        
        const mobileSortFilter = document.getElementById('mobile-sort-filter');
        const mobileSortCurrent = document.getElementById('mobile-sort-current');
        if (mobileSortFilter) mobileSortFilter.value = 'default';
        if (mobileSortCurrent) mobileSortCurrent.innerText = 'Sort: Default';
        
        // AGGIORNA LA UI
        applyFWFilterWithSort();
        renderPopularGames();
        renderGames();
        updateResultCount();
        hideSkeletonLoader();
        
    } catch (e) {
        console.error('[LIBRARY] ❌ Errore fatale:', e);
        
        // FALLBACK: SE ABBIAMO DATI IN CACHE, USALI
        if (cachedGames) {
            console.warn('[LIBRARY] ⚠️ Errore, uso la cache come fallback.');
            allGames = cachedGames;
            allGames.forEach((game, index) => { 
                originalOrderMap.set(game.title, index); 
            });
            applyFWFilterWithSort();
            renderPopularGames();
            renderGames();
            updateResultCount();
            hideSkeletonLoader();
            return;
        }
        
        // FALLBACK ULTIMA SPIAGGIA: RAW URL CON CACHE-BUSTING
        console.warn('[LIBRARY] 🔄 Fallback: caricamento da raw URL');
        try {
            const fallbackUrl = 'exFAT.json?v=' + Date.now();
            const response = await fetch(fallbackUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            if (!Array.isArray(data)) throw new Error('Il file non è un array');
            
            cachedGames = data;
            allGames = data;
            allGames.forEach((game, index) => { 
                originalOrderMap.set(game.title, index); 
            });
            
            applyFWFilterWithSort();
            renderPopularGames();
            renderGames();
            updateResultCount();
            hideSkeletonLoader();
            return;
        } catch (fallbackError) {
            console.error('[LIBRARY] ❌ Fallback fallito:', fallbackError);
        }
        
        // ERRORE FINALE: MOSTRA MESSAGGIO
        hideSkeletonLoader();
        const grid = document.getElementById('game-grid');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:60px; background:rgba(255,0,0,0.1); border-radius:30px; margin:20px;">
                    <div style="font-size:3rem; margin-bottom:20px;">⚠️</div>
                    <h2 style="color:#ff4444;">Errore Caricamento Libreria</h2>
                    <p style="color:rgba(255,255,255,0.7); margin-bottom:20px;">${e.message}</p>
                    <button onclick="location.reload()" style="background:var(--cyan-neon); border:none; padding:12px 30px; border-radius:30px; font-weight:900; cursor:pointer;">🔄 Ricarica Pagina</button>
                </div>
            `;
        }
    }
}

// ===== FUNZIONI PER GESTIRE LA MODALITÀ DI CARICAMENTO =====
function setLocalMode() {
    localStorage.setItem('library_mode', 'local');
    console.log('[LIBRARY] 📁 Modalità LOCALE impostata');
    location.reload();
}

function setApiMode() {
    localStorage.setItem('library_mode', 'api');
    console.log('[LIBRARY] 🌐 Modalità API impostata');
    location.reload();
}

function getLibraryMode() {
    return localStorage.getItem('library_mode') || 'api';
}

function showLibraryModeIndicator() {
    // DISABILITATO
    return;
}

// ===== FUNZIONE PER CARICARE DALL'API (estratta da loadLibrary) =====
async function loadFromApi() {
    console.log('[LIBRARY] 🌐 Tentativo caricamento da API GitHub...');
    const apiUrl = 'https://api.github.com/repos/Pippo26442999/.exFAT/contents/exFAT.json';
    
    const headers = {};
    if (lastETag) {
        headers['If-None-Match'] = lastETag;
        console.log('[LIBRARY] 🔍 Verifico se il file è cambiato...');
    }
    
    try {
        const response = await fetch(apiUrl, { headers });
        
        if (response.status === 304 && cachedGames) {
            console.log('[LIBRARY] ✅ File NON cambiato! Uso la cache locale.');
            return cachedGames;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const apiResponse = await response.json();
        console.log('[LIBRARY] 📦 Metadati ottenuti, SHA:', apiResponse.sha);
        
        // 🔥 USO L'API GIT PER OTTENERE IL BLOB (contiene il file)
        const blobUrl = `https://api.github.com/repos/Pippo26442999/.exFAT/git/blobs/${apiResponse.sha}`;
        console.log('[LIBRARY] 📦 Richiedo blob:', blobUrl);
        
        const blobResponse = await fetch(blobUrl);
        
        if (!blobResponse.ok) {
            throw new Error(`HTTP ${blobResponse.status}: ${blobResponse.statusText}`);
        }
        
        const blobData = await blobResponse.json();
        console.log('[LIBRARY] 📦 Blob ottenuto, encoding:', blobData.encoding);
        
        // Il blob è in base64, lo decodifico
        let jsonString;
        if (blobData.encoding === 'base64') {
            jsonString = atob(blobData.content);
        } else {
            jsonString = blobData.content;
        }
        
        console.log('[LIBRARY] File ricevuto, lunghezza:', jsonString.length, 'bytes');
        
        if (!jsonString || jsonString.trim() === '') {
            throw new Error('Il file exFAT.json è vuoto');
        }
        
        lastETag = response.headers.get('ETag');
        console.log('[LIBRARY] 📦 ETag salvato:', lastETag);
        
        try {
            const data = JSON.parse(jsonString);
            console.log('[LIBRARY] JSON parsato con successo,', Array.isArray(data) ? data.length + ' giochi' : 'oggetto ricevuto');
            return data;
        } catch (jsonError) {
            console.error('[LIBRARY] Errore parsing JSON:', jsonError.message);
            console.log('[LIBRARY] 🔍 Prime 200 caratteri:', jsonString.substring(0, 200));
            throw new Error('JSON malformato');
        }
        
    } catch (error) {
        console.error('[LIBRARY] ❌ Errore loadFromApi:', error);
        throw error;
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
            if (updates && updates.length > 0) { const lastUpdateDate = new Date(updates[0].date); const now = new Date(); const diffInHours = (now - lastUpdateDate) / (1000 * 60 * 60); if (diffInHours >= 0 && diffInHours <= 24) updateBadge = `<div class="update-badge-popular">UPDATE</div>`; }
            
            let ffpkgIndicator = '';
            if (game.ffpkg_akia || game.ffpkg_viki || game.ffpkg_buzz || game.ffpkg_data || game.ffpkg_filek || game.ffpkg_vault) {
            }
            
            htmlContent += `<div class="popular-card" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'><div class="popular-card-bg" style="background-image: url('${game.image}')"></div><div class="popular-card-gradient"></div>${updateBadge}${ffpkgIndicator}<div class="popular-card-content"><div class="popular-card-header"><div class="popular-game-title">${escapeHtml(game.title)}</div>${game.size ? `<div class="popular-size"> ${game.size}</div>` : ''}</div></div><div class="click-hint">✨ Click for details</div></div>`; 
        });
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
    selectedGames.forEach(game => { 
        let updateBadge = ''; 
        const updates = allUpdates[game.title]; 
        if (updates && updates.length > 0) { const lastUpdateDate = new Date(updates[0].date); const now = new Date(); const diffInHours = (now - lastUpdateDate) / (1000 * 60 * 60); if (diffInHours >= 0 && diffInHours <= 24) updateBadge = `<div class="update-badge-popular">UPDATE</div>`; }
        
        let ffpkgIndicator = '';
        if (game.ffpkg_akia || game.ffpkg_viki || game.ffpkg_buzz || game.ffpkg_data || game.ffpkg_filek || game.ffpkg_vault) {
            ffpkgIndicator = `<div style="position:absolute; bottom:70px; left:15px; z-index:5; background:rgba(255,0,128,0.9); color:#fff; padding:3px 10px; border-radius:4px; font-size:0.6rem; font-weight:900; box-shadow:0 0 10px rgba(255,0,128,0.5);">FFPKG</div>`;
        }
        
        htmlContent += `<div class="popular-card" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'><div class="popular-card-bg" style="background-image: url('${game.image}')"></div><div class="popular-card-gradient"></div>${updateBadge}${ffpkgIndicator}<div class="popular-card-content"><div class="popular-card-header"><div class="popular-game-title">${escapeHtml(game.title)}</div>${game.size ? `<div class="popular-size"> ${game.size}</div>` : ''}</div></div><div class="click-hint">✨ Click for details</div></div>`; 
    });
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
        const fixGuide = (game.fix_guide || "").replace(/'/g, "\\'");
        
        // Funzione per creare bottone nella card (IDENTICO PER TUTTI)
        const createBtn = (url, label, isDLC = false, isDump = false, isFix = false) => { 
            if (!url || url === "undefined" || url.trim() === "") return ''; 
            const safeTitle = game.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            // Se è un fix, usa openFixModal
            if (isFix) {
                return `<a onclick="openFixModal('${url}', '${fixGuide}', '${safeTitle}')" class="btn-dl"> ${label}</a>`;
            }
            return `<a onclick="openDLWithAprEmuCheck('${url}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}', ${isDLC}, ${isDump}, '${safeTitle}', ${requireAprEmu})" class="btn-dl">${label}</a>`; 
        };
        
        let downloadHTML = '';
        let dlcBtns = '';
        let dumpBtns = '';
        let ffpkgBtns = '';
        let fixBtns = '';
        
        // ===== FIX =====
        if (game.fix_akia) fixBtns += createBtn(game.fix_akia, 'AKIA', false, false, true);
        if (game.fix_viki) fixBtns += createBtn(game.fix_viki, 'VIKI', false, false, true);
        if (game.fix_buzz) fixBtns += createBtn(game.fix_buzz, 'BUZZ', false, false, true);
        if (game.fix_data) fixBtns += createBtn(game.fix_data, 'DATA', false, false, true);
        if (game.fix_filek) fixBtns += createBtn(game.fix_filek, 'FILEK', false, false, true);
        if (game.fix_vault) fixBtns += createBtn(game.fix_vault, 'VAULT', false, false, true);
        if (game.fix_filed) fixBtns += createBtn(game.fix_filed, 'FILED', false, false, true);
        
        let fixSectionHTML = fixBtns ? `<p class="ver-label"><b>FIX</b></p><div class="download-container">${fixBtns}</div>` : '';
        
        // ===== FFPKG =====
        if (game.ffpkg_akia) ffpkgBtns += createBtn(game.ffpkg_akia, 'AKIA', false, false);
        if (game.ffpkg_viki) ffpkgBtns += createBtn(game.ffpkg_viki, 'VIKI', false, false);
        if (game.ffpkg_buzz) ffpkgBtns += createBtn(game.ffpkg_buzz, 'BUZZ', false, false);
        if (game.ffpkg_data) ffpkgBtns += createBtn(game.ffpkg_data, 'DATA', false, false);
        if (game.ffpkg_filek) ffpkgBtns += createBtn(game.ffpkg_filek, 'FILEK', false, false);
        if (game.ffpkg_vault) ffpkgBtns += createBtn(game.ffpkg_vault, 'VAULT', false, false);
        if (game.ffpkg_filed) ffpkgBtns += createBtn(game.ffpkg_filed, 'FILED', false, false);

        
        let ffpkgSectionHTML = ffpkgBtns ? `<p class="ver-label"><b>FFPKG:</b></p><div class="download-container">${ffpkgBtns}</div>` : '';
        
        // ===== DUMP =====
        if (game.dump_akia) dumpBtns += createBtn(game.dump_akia, 'AKIA', false, true);
        if (game.dump_viki) dumpBtns += createBtn(game.dump_viki, 'VIKI', false, true);
        if (game.dump_buzz) dumpBtns += createBtn(game.dump_buzz, 'BUZZ', false, true);
        if (game.dump_data) dumpBtns += createBtn(game.dump_data, 'DATA', false, true);
        if (game.dump_filek) dumpBtns += createBtn(game.dump_filek, 'FILEK', false, true);
        if (game.dump_vault) dumpBtns += createBtn(game.dump_vault, 'VAULT', false, true);
        if (game.dump_filed) dumpBtns += createBtn(game.dump_filed, 'FILED', false, true);

        
        // ===== DLC =====
        if (game.dlc_akia) dlcBtns += createBtn(game.dlc_akia, 'AKIA', true);
        if (game.dlc_viki) dlcBtns += createBtn(game.dlc_viki, 'VIKI', true);
        if (game.dlc_buzz) dlcBtns += createBtn(game.dlc_buzz, 'BUZZ', true);
        if (game.dlc_data) dlcBtns += createBtn(game.dlc_data, 'DATA', true);
        if (game.dlc_filek) dlcBtns += createBtn(game.dlc_filek, 'FILEK', true);
        if (game.dlc_vault) dlcBtns += createBtn(game.dlc_vault, 'VAULT', true);
        if (game.dlc_filed) dlcBtns += createBtn(game.dlc_filed, 'FILED', true);

        
        // ===== BACKPORT 7.xx e 4.xx =====
        const hasBackport7 = game.backport7xx_akia || game.backport7xx_viki || game.backport7xx_buzz || game.backport7xx_data || game.backport7xx_filek || game.backport7xx_vault;
        const hasBackport4 = game.backport4xx_akia || game.backport4xx_viki || game.backport4xx_buzz || game.backport4xx_data || game.backport4xx_filek || game.backport4xx_vault;
        
        if (hasBackport7 || hasBackport4) {
            let bp7 = '', bp4 = '';
            if (hasBackport7) {
                if (game.backport7xx_akia) bp7 += createBtn(game.backport7xx_akia, 'AKIA');
                if (game.backport7xx_viki) bp7 += createBtn(game.backport7xx_viki, 'VIKI');
                if (game.backport7xx_buzz) bp7 += createBtn(game.backport7xx_buzz, 'BUZZ');
                if (game.backport7xx_data) bp7 += createBtn(game.backport7xx_data, 'DATA');
                if (game.backport7xx_filek) bp7 += createBtn(game.backport7xx_filek, 'FILEK');
                if (game.backport7xx_vault) bp7 += createBtn(game.backport7xx_vault, 'VAULT');
                if (game.backport7xx_filed) bp7 += createBtn(game.backport7xx_filed, 'FILED');

            }
            if (hasBackport4) {
                if (game.backport4xx_akia) bp4 += createBtn(game.backport4xx_akia, 'AKIA');
                if (game.backport4xx_viki) bp4 += createBtn(game.backport4xx_viki, 'VIKI');
                if (game.backport4xx_buzz) bp4 += createBtn(game.backport4xx_buzz, 'BUZZ');
                if (game.backport4xx_data) bp4 += createBtn(game.backport4xx_data, 'DATA');
                if (game.backport4xx_filek) bp4 += createBtn(game.backport4xx_filek, 'FILEK');
                if (game.backport4xx_vault) bp4 += createBtn(game.backport4xx_vault, 'VAULT');
                if (game.backport4xx_filed) bp4 += createBtn(game.backport4xx_filed, 'FILED');

            }
            downloadHTML = `${bp7 ? `<p class="ver-label"><b>BP 7.xx:</b></p><div class="download-container">${bp7}</div>` : ''}${bp4 ? `<p class="ver-label"><b>BP 4.xx:</b></p><div class="download-container">${bp4}</div>` : ''}`;
        } 
        // STANDARD e BACKPORT
        else if (game.standard_akia || game.standard_viki || game.standard_buzz || game.standard_data || game.standard_filek || game.standard_vault || game.backport_akia || game.backport_viki || game.backport_buzz || game.backport_data || game.backport_filek || game.backport_vault) {
            let std = '', bp = '';
            if (game.standard_akia) std += createBtn(game.standard_akia, 'AKIA');
            if (game.standard_viki) std += createBtn(game.standard_viki, 'VIKI');
            if (game.standard_buzz) std += createBtn(game.standard_buzz, 'BUZZ');
            if (game.standard_data) std += createBtn(game.standard_data, 'DATA');
            if (game.standard_filek) std += createBtn(game.standard_filek, 'FILEK');
            if (game.standard_vault) std += createBtn(game.standard_vault, 'VAULT');
            if (game.backport_akia) bp += createBtn(game.backport_akia, 'AKIA');
            if (game.backport_viki) bp += createBtn(game.backport_viki, 'VIKI');
            if (game.backport_buzz) bp += createBtn(game.backport_buzz, 'BUZZ');
            if (game.backport_data) bp += createBtn(game.backport_data, 'DATA');
            if (game.backport_filek) bp += createBtn(game.backport_filek, 'FILEK');
            if (game.backport_vault) bp += createBtn(game.backport_vault, 'VAULT');
            if (game.backport_filed) bp += createBtn(game.backport_filed, 'FILED');
            downloadHTML = `${std ? `<p class="ver-label"><b>STANDARD:</b></p><div class="download-container">${std}</div>` : ''}${bp ? `<p class="ver-label"><b>BACKPORT:</b></p><div class="download-container">${bp}</div>` : ''}`;
        } 
        // LINK SEMPLICI
        else {
            let btns = '';
            if (game.akia_url) btns += createBtn(game.akia_url, 'AKIA');
            if (game.viki_url) btns += createBtn(game.viki_url, 'VIKI');
            if (game.buzz_url) btns += createBtn(game.buzz_url, 'BUZZ');
            if (game.data_url) btns += createBtn(game.data_url, 'DATA');
            if (game.filek_url) btns += createBtn(game.filek_url, 'FILEK');
            if (game.vault_url) btns += createBtn(game.vault_url, 'VAULT');
            if (game.filed_url) btns += createBtn(game.vault_url, 'FILED');
            downloadHTML = `<div class="download-container" style="margin-top:15px;">${btns}</div>`;
        }
        
        let dumpSectionHTML = dumpBtns ? `<p class="ver-label"><b>DUMP:</b></p><div class="download-container">${dumpBtns}</div>` : '';
        let dlcSectionHTML = dlcBtns ? `<p class="ver-label"><b>DLCs:</b></p><div class="download-container">${dlcBtns}</div>` : '';
        
        grid.innerHTML += `<div class="game-card">${updateBadge}<span class="game-title">${escapeHtml(game.title)}</span><div class="image-container"><img src="${game.image}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/400x400/0a0a1a/cyan?text=No+Image'"><div class="tags-overlay">${tagsHTML}</div><div class="game-badges">${aprEmuHTML}${sizeHTML}</div></div><div class="download-section">${ffpkgSectionHTML}${downloadHTML}${fixSectionHTML}${dumpSectionHTML}${dlcSectionHTML}</div></div>`;
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

document.getElementById('modal-close-btn').onclick = () => { 
    document.getElementById('game-detail-modal').style.display = 'none'; 
    isRandomModeActive = false;
    clearAprEmuBadge();
};

window.onclick = (e) => { 
    if (e.target.classList.contains('game-modal')) { 
        e.target.style.display = 'none'; 
        isRandomModeActive = false;
        clearAprEmuBadge();
    } 
};

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('scroll', () => { const nav = document.querySelector('nav'); if (nav) { if (window.scrollY > 20) nav.classList.add('scrolled'); else nav.classList.remove('scrolled'); } }, { passive: true });
document.getElementById('next-page').onclick = () => { currentPage++; renderGames(); scrollToTop(true); };
document.getElementById('prev-page').onclick = () => { currentPage--; renderGames(); scrollToTop(true); };
