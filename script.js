let allGames = [];
let filteredGames = [];
let allUpdates = {}; 
let currentPage = 1;
let autoScrollInterval = null;
let isDragging = false;
let startX = 0;
let currentTranslate = 0;
let animationId = null;
let currentPosition = 0;
let cardWidth = 575;
let dragStartTime = 0;
let dragDistance = 0;
let hasMoved = false;
let integrityCheckInterval = null;
let protectionInterval = null;
const itemsPerPage = 21;
const SECRET_HASH = "a2242ead55c94c3deb7cf2340bfef9d5bcaca22dfe66e646745ee4371c633fc8";

// Salva i riferimenti originali
const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
const originalGetItem = sessionStorage.getItem.bind(sessionStorage);
const originalRemoveItem = sessionStorage.removeItem.bind(sessionStorage);

// Override di sessionStorage.setItem con controllo stack
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

// Override di sessionStorage.removeItem
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

async function init() {
    if (!checkIntegrity()) return;
    
    const unlocked = originalGetItem('unlocked');
    const unlockedTime = originalGetItem('unlocked_time');
    const overlay = document.getElementById('site-lock-overlay');
    
    if (unlocked === SECRET_HASH) {
        if (!unlockedTime) {
            originalRemoveItem('unlocked');
            location.reload();
            return;
        }
        const time = parseInt(unlockedTime);
        if (Date.now() - time > 24 * 60 * 60 * 1000) {
            originalRemoveItem('unlocked');
            originalRemoveItem('unlocked_time');
            location.reload();
            return;
        }
    }
    
    await loadUpdates();
    await loadLibrary();
    setupDropdown();
    setupCarousel();
    
    if (unlocked === SECRET_HASH) {
        if (overlay) {
            overlay.remove();
        }
        document.body.style.overflow = 'auto';
        startIntegrityCheck();
        startProtection();
    } else {
        document.body.style.overflow = 'hidden';
        startProtection();
    }
}

async function loadUpdates() {
    try {
        const response = await fetch('old_updates.json?v=' + Date.now());
        if (response.ok) {
            allUpdates = await response.json();
        }
    } catch (e) {
        console.warn("Updates file non trovato.");
    }
}

async function loadLibrary() {
    try {
        const response = await fetch('exFAT.json?v=' + Date.now());
        if (!response.ok) throw new Error("Errore JSON Network");
        
        const text = await response.text();
        try {
            allGames = JSON.parse(text);
        } catch (jsonError) {
            alert("🚨 ERRORE FATALE: Il tuo file exFAT.json è rotto!\nHai dimenticato una virgola o una parentesi quando hai aggiunto l'ultimo gioco.\nCorreggi il file JSON e ricarica la pagina.");
            return;
        }
        
        filteredGames = [...allGames];
        renderPopularGames();
        renderGames();
    } catch (e) { 
        console.error("Errore caricamento library:", e);
    }
}

function setupCarousel() {
    const container = document.getElementById('carousel-container');
    const track = document.getElementById('popular-track');
    
    if (!container || !track) return;
    
    const halfWidth = track.scrollWidth / 2;
    let startTime = null;
    let autoScrollActive = true;
    let startDragX = 0;
    let startDragPos = 0;
    
    function autoScrollAnimation(timestamp) {
        if (!autoScrollActive || isDragging) {
            animationId = requestAnimationFrame(autoScrollAnimation);
            return;
        }
        
        if (!startTime) startTime = timestamp;
        
        const speed = 0.25;
        currentPosition = (currentPosition + speed) % halfWidth;
        
        track.style.transform = `translateX(-${currentPosition}px)`;
        
        animationId = requestAnimationFrame(autoScrollAnimation);
    }
    
    const startDrag = (e) => {
        if (e.button === 2) return;
        if (e.type === 'contextmenu') return;
        
        e.preventDefault();
        
        hasMoved = false;
        dragDistance = 0;
        dragStartTime = Date.now();
        window._wasDrag = false;
        
        if (autoScrollActive) {
            autoScrollActive = false;
        }
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
        
        if (Math.abs(diff) > 5) {
            hasMoved = true;
            window._wasDrag = true;
            dragDistance = Math.abs(diff);
        }
        
        let newPosition = startDragPos - diff;
        
        const halfTrack = track.scrollWidth / 2;
        if (newPosition >= halfTrack) {
            newPosition -= halfTrack;
            startDragPos -= halfTrack;
        } else if (newPosition < 0) {
            newPosition += halfTrack;
            startDragPos += halfTrack;
        }
        
        currentPosition = newPosition;
        track.style.transform = `translateX(-${currentPosition}px)`;
    };
    
    const endDrag = () => {
        if (!isDragging) return;
        
        isDragging = false;
        track.style.transition = '';
        container.style.cursor = 'grab';
        
        setTimeout(() => {
            if (!isDragging) {
                autoScrollActive = true;
                startTime = null;
                window._wasDrag = false;
            }
        }, 2000);
    };
    
    container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    
    container.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
    
    container.addEventListener('touchstart', startDrag);
    window.addEventListener('touchmove', onDrag, { passive: false });
    window.addEventListener('touchend', endDrag);
    
    container.addEventListener('mouseenter', () => {
        autoScrollActive = false;
    });
    
    container.addEventListener('mouseleave', () => {
        if (!isDragging) {
            autoScrollActive = true;
            startTime = null;
        }
    });
    
    animationId = requestAnimationFrame(autoScrollAnimation);
}

async function hashStr(str) {
    if (!crypto || !crypto.subtle) {
        alert("⚠️ ERRORE BROWSER: Il telefono sta bloccando lo script di sicurezza. Per testare la password devi caricare i file su GitHub Pages, non puoi aprirli direttamente dalla memoria del telefono!");
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
            originalSetItem('unlocked_time', Date.now().toString());
            originalSetItem('unlocked', SECRET_HASH);
            
            overlay.style.transition = 'opacity 0.5s ease';
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                document.body.style.overflow = 'auto';
                startIntegrityCheck();
            }, 500);
        } else {
            errorMsg.style.display = 'block';
            lockBox.style.animation = 'none';
            lockBox.offsetHeight;
            lockBox.style.animation = 'shake 0.3s ease-in-out';
            document.getElementById('site-pw-input').value = '';
        }
    } catch (e) {
        console.error("Errore password:", e);
    }
}

function startProtection() {
    const observer = new MutationObserver(() => {
        const unlocked = originalGetItem('unlocked');
        const overlay = document.getElementById('site-lock-overlay');
        
        if (!overlay && unlocked !== SECRET_HASH) {
            location.reload();
        }
        
        if (overlay && unlocked === SECRET_HASH) {
            overlay.remove();
            document.body.style.overflow = 'auto';
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    if (protectionInterval) clearInterval(protectionInterval);
    protectionInterval = setInterval(() => {
        const unlocked = originalGetItem('unlocked');
        const overlay = document.getElementById('site-lock-overlay');
        const unlockedTime = originalGetItem('unlocked_time');
        
        if (unlocked === SECRET_HASH && !unlockedTime) {
            originalRemoveItem('unlocked');
            location.reload();
        }
        
        if (unlocked === SECRET_HASH && unlockedTime) {
            const time = parseInt(unlockedTime);
            if (Date.now() - time > 24 * 60 * 60 * 1000) {
                originalRemoveItem('unlocked');
                originalRemoveItem('unlocked_time');
                location.reload();
            }
        }
        
        if (!overlay && unlocked !== SECRET_HASH) {
            location.reload();
        }
    }, 1000);
}

function setupDropdown() {
    const dropdown = document.getElementById('fw-dropdown');
    if (!dropdown) return;
    const trigger = dropdown.querySelector('.dropdown-trigger');
    const optionsContainer = document.getElementById('fw-options');
    const currentText = document.getElementById('fw-current');
    const hiddenInput = document.getElementById('fw-filter');
    const allOptions = dropdown.querySelectorAll('.option');
    
    trigger.onclick = (e) => {
        e.stopPropagation();
        optionsContainer.classList.toggle('show');
        dropdown.classList.toggle('active');
    };
    
    allOptions.forEach(opt => {
        opt.onclick = () => {
            const val = opt.getAttribute('data-value');
            currentText.innerText = opt.innerText;
            hiddenInput.value = val;
            optionsContainer.classList.remove('show');
            dropdown.classList.remove('active');
            applyFilters(); 
        };
    });
    
    window.addEventListener('click', () => {
        optionsContainer.classList.remove('show');
        dropdown.classList.remove('active');
    });
}

function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);

    filteredGames = allGames.filter(g => {
        const matchesSearch = g.title.toLowerCase().includes(searchTerm);
        
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

            if (foundVersions.length > 0) {
                gameFW = Math.min(...foundVersions);
            }
        }
        
        const matchesFW = gameFW <= selectedFW;
        return matchesSearch && matchesFW;
    });

    currentPage = 1;
    renderGames();
}

function openGameModal(game, event) {
    if (event && event.button === 2) {
        event.preventDefault();
        return false;
    }
    
    if (hasMoved || window._wasDrag) {
        hasMoved = false;
        window._wasDrag = false;
        return false;
    }
    
    hasMoved = false;
    window._wasDrag = false;
    
    const modalHeader = document.getElementById('modal-header');
    modalHeader.style.backgroundImage = `url('${game.image}')`;
    modalHeader.style.backgroundSize = 'cover';
    modalHeader.style.backgroundPosition = 'center';
    
    document.getElementById('modal-title').textContent = game.title;
    
    const tagsContainer = document.getElementById('modal-tags');
    tagsContainer.innerHTML = (game.tags || []).map(t => `<span class="modal-tag">${t}</span>`).join('');
    
    document.getElementById('modal-size').textContent = game.size || 'N/A';
    
    const downloadsContainer = document.getElementById('modal-downloads');
    const hPlay = (game.how_to_play || "").replace(/'/g, "\\'");
    const dCredits = game.credits_dlc || game.credits_dlcs || '';
    
    const createModalBtn = (url, label) => {
        if (!url || url === "undefined" || url.trim() === "") return '';
        return `<button onclick="startDownloadFromModal('${url}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}', false, '${game.title.replace(/'/g, "\\'")}')" class="modal-btn">${label}</button>`;
    };
    
    let downloadsHTML = '';
    
    // Controllo se ESISTE ALMENO UN campo backport (7.xx o 4.xx)
    const hasBackport7 = game.backport7xx_akia || game.backport7xx_viki || game.backport7xx_buzz || game.backport7xx_data;
    const hasBackport4 = game.backport4xx_akia || game.backport4xx_viki || game.backport4xx_buzz || game.backport4xx_data;
    
    if (hasBackport7 || hasBackport4) {
        let bp7 = '';
        if (hasBackport7) {
            if (game.backport7xx_akia) bp7 += createModalBtn(game.backport7xx_akia, 'AKIA');
            if (game.backport7xx_viki) bp7 += createModalBtn(game.backport7xx_viki, 'VIKI');
            if (game.backport7xx_buzz) bp7 += createModalBtn(game.backport7xx_buzz, 'BUZZ');
            if (game.backport7xx_data) bp7 += createModalBtn(game.backport7xx_data, 'DATA');
        }
        
        let bp4 = '';
        if (hasBackport4) {
            if (game.backport4xx_akia) bp4 += createModalBtn(game.backport4xx_akia, 'AKIA');
            if (game.backport4xx_viki) bp4 += createModalBtn(game.backport4xx_viki, 'VIKI');
            if (game.backport4xx_buzz) bp4 += createModalBtn(game.backport4xx_buzz, 'BUZZ');
            if (game.backport4xx_data) bp4 += createModalBtn(game.backport4xx_data, 'DATA');
        }
        
        downloadsHTML = `${bp7 ? `<div style="width:100%; margin-bottom:10px;"><strong>Backport 7.xx</strong></div>${bp7}` : ''}${bp4 ? `<div style="width:100%; margin-bottom:10px; margin-top:10px;"><strong>Backport 4.xx</strong></div>${bp4}` : ''}`;
    } 
    else if (game.standard_akia || game.standard_viki || game.standard_buzz || game.standard_data || game.backport_akia || game.backport_viki || game.backport_buzz || game.backport_data) {
        let std = '';
        if (game.standard_akia) std += createModalBtn(game.standard_akia, 'AKIA');
        if (game.standard_viki) std += createModalBtn(game.standard_viki, 'VIKI');
        if (game.standard_buzz) std += createModalBtn(game.standard_buzz, 'BUZZ');
        if (game.standard_data) std += createModalBtn(game.standard_data, 'DATA');
        
        let bp = '';
        if (game.backport_akia) bp += createModalBtn(game.backport_akia, 'AKIA');
        if (game.backport_viki) bp += createModalBtn(game.backport_viki, 'VIKI');
        if (game.backport_buzz) bp += createModalBtn(game.backport_buzz, 'BUZZ');
        if (game.backport_data) bp += createModalBtn(game.backport_data, 'DATA');
        
        downloadsHTML = `${std ? `<div style="width:100%; margin-bottom:10px;"><strong>STANDARD</strong></div>${std}` : ''}${bp ? `<div style="width:100%; margin-bottom:10px; margin-top:10px;"><strong>BACKPORT</strong></div>${bp}` : ''}`;
    } 
    else {
        // Giochi semplici
        let btns = '';
        if (game.akia_url) btns += createModalBtn(game.akia_url, 'AKIA');
        if (game.viki_url) btns += createModalBtn(game.viki_url, 'VIKI');
        if (game.buzz_url) btns += createModalBtn(game.buzz_url, 'BUZZ');
        if (game.data_url) btns += createModalBtn(game.data_url, 'DATA');
        downloadsHTML = btns;
    }
    
    downloadsContainer.innerHTML = downloadsHTML;
    
    // DLCs section
    const dlcSection = document.getElementById('modal-dlc-section');
    const dlcContainer = document.getElementById('modal-dlc');
    let dlcBtns = '';
    if (game.dlc_akia) dlcBtns += `<button onclick="startDownloadFromModal('${game.dlc_akia}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}', true, '${game.title.replace(/'/g, "\\'")}')" class="modal-btn">AKIA</button>`;
    if (game.dlc_viki) dlcBtns += `<button onclick="startDownloadFromModal('${game.dlc_viki}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}', true, '${game.title.replace(/'/g, "\\'")}')" class="modal-btn">VIKI</button>`;
    if (game.dlc_buzz) dlcBtns += `<button onclick="startDownloadFromModal('${game.dlc_buzz}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}', true, '${game.title.replace(/'/g, "\\'")}')" class="modal-btn">BUZZ</button>`;
    if (game.dlc_data) dlcBtns += `<button onclick="startDownloadFromModal('${game.dlc_data}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}', true, '${game.title.replace(/'/g, "\\'")}')" class="modal-btn">DATA</button>`;
    
    if (dlcBtns) {
        dlcSection.style.display = 'block';
        dlcContainer.innerHTML = dlcBtns;
    } else {
        dlcSection.style.display = 'none';
    }
    
    let parts = [];
    const fileAuthor = game.credits_files;
    const bpAuthor = game.credits_backport;
    const dlcAuthor = game.credits_dlc || game.credits_dlcs;
    
    if (fileAuthor && dlcAuthor && fileAuthor === dlcAuthor) {
        parts.push(`<b>${fileAuthor}</b> for the Files with DLCs`);
    } else {
        if (fileAuthor) parts.push(`<b>${fileAuthor}</b> for the Files`);
        if (dlcAuthor) parts.push(`<b>${dlcAuthor}</b> for DLCs`);
    }
    if (bpAuthor) parts.push(`<b>${bpAuthor}</b> for the BackPort`);
    
    let creditsText = parts.length > 0 ? "Thanks to " + parts.join(", ").replace(/, ([^,]*)$/, ' and $1') : "Thanks to the community.";
    document.getElementById('modal-credits').innerHTML = creditsText;
    
    const instSection = document.getElementById('modal-instructions');
    if (game.how_to_play) {
        instSection.style.display = 'block';
        document.getElementById('modal-instructions-text').innerHTML = game.how_to_play;
    } else {
        instSection.style.display = 'none';
    }
    
    const updatesSection = document.getElementById('modal-updates');
    const updatesList = document.getElementById('modal-updates-list');
    const updates = allUpdates[game.title];
    if (updates && updates.length > 0) {
        updatesSection.style.display = 'block';
        updatesList.innerHTML = updates.map(upd => {
            const dp = upd.date.split('-');
            const formattedDate = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : upd.date;
            return `
                <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div>
                            <strong>${upd.version}</strong> <small style="opacity:0.6;">(${upd.size || 'N/A'})</small><br>
                            <small style="color:var(--cyan-neon);">Released: ${formattedDate}</small>
                        </div>
                        <div style="display:flex; gap:8px;">
                            ${upd.akia_url ? `<a href="${upd.akia_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">AKIA</a>` : ''}
                            ${upd.viki_url ? `<a href="${upd.viki_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">VIKI</a>` : ''}
                            ${upd.buzz_url ? `<a href="${upd.buzz_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">BUZZ</a>` : ''}
                            ${upd.data_url ? `<a href="${upd.data_url}" target="_blank" class="modal-btn" style="padding:6px 12px; font-size:0.7rem;">DATA</a>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('');
    } else {
        updatesSection.style.display = 'none';
    }
    
    const creditsModal = document.getElementById('credits-modal');
    if (creditsModal) {
        creditsModal.style.display = 'none';
    }
    
    document.getElementById('game-detail-modal').style.display = 'block';
}

function startDownloadFromModal(url, fAuth, bAuth, dAuth, hPlay, isDLC, gameTitle) {
    openDL(url, fAuth, bAuth, dAuth, hPlay, isDLC, gameTitle);
}

function renderPopularGames() {
    const track = document.getElementById('popular-track');
    const section = document.getElementById('popular-section');
    if (!track || !section) return;

    const popularGames = allGames.filter(g => g.popular === "on");
    
    if (popularGames.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'flex';
    
    const shuffledGames = [...popularGames];
    for (let i = shuffledGames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledGames[i], shuffledGames[j]] = [shuffledGames[j], shuffledGames[i]];
    }
    
    let htmlContent = '';

    shuffledGames.forEach(game => {
        let updateBadge = '';
        const updates = allUpdates[game.title];
        if (updates && updates.length > 0) {
            const lastUpdateDate = new Date(updates[0].date);
            const now = new Date();
            const diffInHours = (now - lastUpdateDate) / (1000 * 60 * 60);

            if (diffInHours >= 0 && diffInHours <= 24) {
                updateBadge = `<div class="update-badge-popular">UPDATE</div>`;
            }
        }

        htmlContent += `
            <div class="popular-card" data-game='${JSON.stringify(game).replace(/'/g, "&#39;").replace(/"/g, '&quot;')}'>
                <div class="popular-card-bg" style="background-image: url('${game.image}')"></div>
                <div class="popular-card-gradient"></div>
                ${updateBadge}
                <div class="popular-card-content">
                    <div class="popular-card-header">
                        <div class="popular-game-title">${game.title}</div>
                        ${game.size ? `<div class="popular-size"> ${game.size}</div>` : ''}
                    </div>
                </div>
                <div class="click-hint">✨ Click for details</div>
            </div>`;
    });

    track.innerHTML = htmlContent + htmlContent;
    
    let pressTimer = null;
    let isLongPressActive = false;
    let touchMoved = false;
    
    const cards = document.querySelectorAll('.popular-card');
    
    cards.forEach(card => {
        const oldCard = card.cloneNode(true);
        card.parentNode.replaceChild(oldCard, card);
        
        oldCard.addEventListener('click', function(e) {
            e.stopPropagation();
            if (isLongPressActive) {
                isLongPressActive = false;
                return;
            }
            const gameDataAttr = this.getAttribute('data-game');
            if (gameDataAttr) {
                try {
                    const decoded = gameDataAttr.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                    const game = JSON.parse(decoded);
                    openGameModal(game, e);
                } catch(err) {
                    console.error("Errore:", err);
                }
            }
        });
        
        oldCard.addEventListener('touchstart', function(e) {
            touchMoved = false;
            isLongPressActive = false;
            window._isLongPress = false;
            
            pressTimer = setTimeout(() => {
                isLongPressActive = true;
                window._isLongPress = true;
                this.style.opacity = '0.7';
                const container = document.getElementById('carousel-container');
                const dragEvent = new TouchEvent('touchstart', {
                    touches: e.touches,
                    target: container,
                    cancelable: true
                });
                container.dispatchEvent(dragEvent);
            }, 200);
        });
        
        oldCard.addEventListener('touchmove', function(e) {
            touchMoved = true;
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        });
        
        oldCard.addEventListener('touchend', function(e) {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            this.style.opacity = '';
            if (!isLongPressActive && !touchMoved) {
                setTimeout(() => {
                    if (!window._wasDrag) {
                        const clickEvent = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        this.dispatchEvent(clickEvent);
                    }
                }, 10);
            }
            setTimeout(() => {
                window._isLongPress = false;
                isLongPressActive = false;
            }, 100);
        });
        
        oldCard.addEventListener('touchcancel', function(e) {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            this.style.opacity = '';
            window._isLongPress = false;
            isLongPressActive = false;
        });
    });
}

function renderGames() {
    const grid = document.getElementById('game-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredGames.slice(startIndex, startIndex + itemsPerPage);

    if (pageItems.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; font-size:1.5rem;">No games found.</p>';
        return;
    }

    pageItems.forEach(game => {
        let tagsHTML = (game.tags || []).map(t => `<span class="game-tag">${t}</span>`).join('');
        let sizeHTML = game.size ? `<div class="game-size">${game.size}</div>` : '';
        
        let updateBadge = '';
        const updates = allUpdates[game.title];
        if (updates && updates.length > 0) {
            const lastUpdateDate = new Date(updates[0].date);
            const now = new Date();
            const diffInHours = (now - lastUpdateDate) / (1000 * 60 * 60);

            if (diffInHours >= 0 && diffInHours <= 24) {
                updateBadge = `<div class="update-badge" style="position:absolute; top:15px; left:15px; background:var(--green-neon); color:#000; padding:4px 10px; border-radius:8px; font-weight:900; font-size:0.7rem; z-index:20; box-shadow:0 0 10px var(--green-neon); animation: pulseRed 2s infinite;">UPDATE</div>`;
            }
        }

        const hPlay = (game.how_to_play || "").replace(/'/g, "\\'");
        const dCredits = game.credits_dlc || game.credits_dlcs || '';

        const createBtn = (url, label, isDLC = false) => {
            if (!url || url === "undefined" || url.trim() === "") return '';
            return `<a onclick="openDL('${url}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}', ${isDLC}, '${game.title.replace(/'/g, "\\'")}')" class="btn-dl">${label}</a>`;
        };

        let downloadHTML = '';
        
        // DLCs
        let dlcBtns = '';
        if (game.dlc_akia) dlcBtns += createBtn(game.dlc_akia, 'AKIA', true);
        if (game.dlc_viki) dlcBtns += createBtn(game.dlc_viki, 'VIKI', true);
        if (game.dlc_buzz) dlcBtns += createBtn(game.dlc_buzz, 'BUZZ', true);
        if (game.dlc_data) dlcBtns += createBtn(game.dlc_data, 'DATA', true);
        let dlcSection = dlcBtns ? `<p class="ver-label"><b>DLCs:</b></p><div class="download-container">${dlcBtns}</div>` : '';

        // Controllo se ESISTE ALMENO UN campo backport (7.xx o 4.xx)
        const hasBackport7 = game.backport7xx_akia || game.backport7xx_viki || game.backport7xx_buzz || game.backport7xx_data;
        const hasBackport4 = game.backport4xx_akia || game.backport4xx_viki || game.backport4xx_buzz || game.backport4xx_data;
        
        if (hasBackport7 || hasBackport4) {
            let bp7 = '';
            if (hasBackport7) {
                if (game.backport7xx_akia) bp7 += createBtn(game.backport7xx_akia, 'AKIA');
                if (game.backport7xx_viki) bp7 += createBtn(game.backport7xx_viki, 'VIKI');
                if (game.backport7xx_buzz) bp7 += createBtn(game.backport7xx_buzz, 'BUZZ');
                if (game.backport7xx_data) bp7 += createBtn(game.backport7xx_data, 'DATA');
            }
            
            let bp4 = '';
            if (hasBackport4) {
                if (game.backport4xx_akia) bp4 += createBtn(game.backport4xx_akia, 'AKIA');
                if (game.backport4xx_viki) bp4 += createBtn(game.backport4xx_viki, 'VIKI');
                if (game.backport4xx_buzz) bp4 += createBtn(game.backport4xx_buzz, 'BUZZ');
                if (game.backport4xx_data) bp4 += createBtn(game.backport4xx_data, 'DATA');
            }
            
            downloadHTML = `${bp7 ? `<p class="ver-label"><b>BP 7.xx:</b></p><div class="download-container">${bp7}</div>` : ''}${bp4 ? `<p class="ver-label"><b>BP 4.xx:</b></p><div class="download-container">${bp4}</div>` : ''}`;
        } 
        else if (game.standard_akia || game.standard_viki || game.standard_buzz || game.standard_data || game.backport_akia || game.backport_viki || game.backport_buzz || game.backport_data) {
            let std = '';
            if (game.standard_akia) std += createBtn(game.standard_akia, 'AKIA');
            if (game.standard_viki) std += createBtn(game.standard_viki, 'VIKI');
            if (game.standard_buzz) std += createBtn(game.standard_buzz, 'BUZZ');
            if (game.standard_data) std += createBtn(game.standard_data, 'DATA');
            
            let bp = '';
            if (game.backport_akia) bp += createBtn(game.backport_akia, 'AKIA');
            if (game.backport_viki) bp += createBtn(game.backport_viki, 'VIKI');
            if (game.backport_buzz) bp += createBtn(game.backport_buzz, 'BUZZ');
            if (game.backport_data) bp += createBtn(game.backport_data, 'DATA');
            
            downloadHTML = `${std ? `<p class="ver-label"><b>STANDARD:</b></p><div class="download-container">${std}</div>` : ''}${bp ? `<p class="ver-label"><b>BACKPORT:</b></p><div class="download-container">${bp}</div>` : ''}`;
        } 
        else {
            // Giochi semplici
            let btns = '';
            if (game.akia_url) btns += createBtn(game.akia_url, 'AKIA');
            if (game.viki_url) btns += createBtn(game.viki_url, 'VIKI');
            if (game.buzz_url) btns += createBtn(game.buzz_url, 'BUZZ');
            if (game.data_url) btns += createBtn(game.data_url, 'DATA');
            downloadHTML = `<div class="download-container" style="margin-top:15px;">${btns}</div>`;
        }

        grid.innerHTML += `
            <div class="game-card">
                ${updateBadge}
                <span class="game-title">${game.title}</span>
                <div class="image-container">
                    <img src="${game.image}" referrerpolicy="no-referrer">
                    <div class="tags-overlay">${tagsHTML}</div>
                    ${sizeHTML} 
                </div>
                <div class="download-section">${downloadHTML}${dlcSection}</div>
            </div>`;
    });

    const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
    document.getElementById('page-info').innerText = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

function openDL(url, fAuth, bAuth, dAuth, hPlay, isDLC = false, gameTitle) {
    let parts = [];
    const clean = (str) => (str && str !== "undefined" && str.trim() !== "") ? str.trim() : null;

    const fileAuthor = clean(fAuth);
    const bpAuthor = clean(bAuth);
    const dlcAuthor = clean(dAuth);
    const playInstructions = clean(hPlay);

    if (fileAuthor && dlcAuthor && fileAuthor === dlcAuthor) {
        parts.push(`<b>${fileAuthor}</b> for the Files with DLCs`);
    } else {
        if (fileAuthor) parts.push(`<b>${fileAuthor}</b> for the Files`);
        if (dlcAuthor) parts.push(`<b>${dlcAuthor}</b> for DLCs`);
    }
    if (bpAuthor) parts.push(`<b>${bpAuthor}</b> for the BackPort`);

    let creditsText = parts.length > 0 ? "Thanks to " + parts.join(", ").replace(/, ([^,]*)$/, ' and $1') : "Thanks to the community.";

    let updateHTML = "";
    const updates = allUpdates[gameTitle];
    if (updates && updates.length > 0) {
        updateHTML = `
            <div style="margin-top:20px; padding-top:15px; border-top:1px dashed rgba(0,255,238,0.3); text-align:left;">
                <b style="color:var(--cyan-neon); font-size:0.75rem; text-transform:uppercase; display:block; margin-bottom:10px;">OLD RELEASES:</b>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${updates.map(upd => {
                        const dp = upd.date.split('-');
                        const formattedDate = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : upd.date;
                        return `
                        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,255,255,0.1);">
                            <div style="display:flex; flex-direction:column;">
                                <span style="font-size:0.8rem; font-weight:700;">${upd.version} <small style="opacity:0.6;">(${upd.size || 'N/A'})</small></span>
                                <span style="font-size:0.6rem; color:var(--cyan-neon); opacity:0.8;">Released: ${formattedDate}</span>
                            </div>
                            <div style="display:flex; gap:5px;">
                                ${upd.akia_url ? `<a href="${upd.akia_url}" target="_blank" style="padding:4px 8px; background:var(--bg-1); border:1px solid var(--cyan-neon); color:var(--cyan-neon); border-radius:5px; font-size:0.65rem; text-decoration:none; font-weight:900;">AKIA</a>` : ''}
                                ${upd.viki_url ? `<a href="${upd.viki_url}" target="_blank" style="padding:4px 8px; background:var(--bg-1); border:1px solid var(--cyan-neon); color:var(--cyan-neon); border-radius:5px; font-size:0.65rem; text-decoration:none; font-weight:900;">VIKI</a>` : ''}
                                ${upd.buzz_url ? `<a href="${upd.buzz_url}" target="_blank" style="padding:4px 8px; background:var(--bg-1); border:1px solid var(--cyan-neon); color:var(--cyan-neon); border-radius:5px; font-size:0.65rem; text-decoration:none; font-weight:900;">BUZZ</a>` : ''}
                                ${upd.data_url ? `<a href="${upd.data_url}" target="_blank" style="padding:4px 8px; background:var(--bg-1); border:1px solid var(--cyan-neon); color:var(--cyan-neon); border-radius:5px; font-size:0.65rem; text-decoration:none; font-weight:900;">DATA</a>` : ''}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
    }

    let instHTML = "";
    if (isDLC) {
        instHTML = `<div style="margin-top:15px; padding:12px; background:rgba(57,255,20,0.08); border-radius:12px; font-size:0.85rem; color:var(--green-neon); border:1px solid rgba(57,255,20,0.2); text-align:left; line-height:1.4;"><b style="text-transform:uppercase; font-size:0.75rem; display:block; margin-bottom:5px; opacity:0.8;">How to Unlock All DLCs:</b>Install the title (.exFAT) then the DLCs.${playInstructions ? `<br><br><b style="text-transform:uppercase; font-size:0.75rem; display:block; margin-bottom:5px; opacity:0.8;">Extra Info:</b>${playInstructions}` : ''}</div>`;
    } else if (playInstructions) {
        instHTML = `<div style="margin-top:15px; padding:12px; background:rgba(57,255,20,0.08); border-radius:12px; font-size:0.85rem; color:var(--green-neon); border:1px solid rgba(57,255,20,0.2); text-align:left; line-height:1.4;"><b style="text-transform:uppercase; font-size:0.75rem; display:block; margin-bottom:5px; opacity:0.8;">Instructions / How to Play:</b>${playInstructions}</div>`;
    }

    const creditsBody = document.getElementById('credits-body');
    if (creditsBody) creditsBody.innerHTML = `<div style="font-size:1.05rem; line-height:1.5;">${creditsText}</div>${instHTML}${updateHTML}`;

    document.getElementById('final-download-btn').href = url;
    document.getElementById('pw-instruction').style.display = 'block';
    document.getElementById('pw-final').style.display = 'none';
    document.getElementById('credits-modal').style.display = "block";
}

window.revealPassword = () => {
    document.getElementById('pw-instruction').style.display = 'none';
    document.getElementById('pw-final').style.display = 'block';
};

document.getElementById('modal-close-btn').onclick = () => {
    document.getElementById('game-detail-modal').style.display = 'none';
};

window.onclick = (e) => {
    if (e.target.classList.contains('game-modal')) {
        e.target.style.display = 'none';
    }
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
};

window.addEventListener('DOMContentLoaded', init);

window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (nav) {
        if (window.scrollY > 20) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    }
});

document.getElementById('next-page').onclick = () => { currentPage++; renderGames(); window.scrollTo(0,0); };
document.getElementById('prev-page').onclick = () => { currentPage--; renderGames(); window.scrollTo(0,0); };

const sTrig = document.getElementById('search-trigger');
const sInp = document.getElementById('search-input');

if(sTrig) sTrig.onclick = () => { sInp.classList.toggle('active'); sInp.focus(); };
if(sInp) sInp.oninput = applyFilters;

document.getElementById('dmca-link').onclick = async () => {
    try {
        const res = await fetch('DMCA.json');
        const data = await res.json();
        document.getElementById('dmca-title').innerText = data.title;
        document.getElementById('dmca-body').innerHTML = data.content.map(p => `<p>${p}</p>`).join('');
        document.getElementById('dmca-modal').style.display = "block";
    } catch(err) { console.error(err); }
};

document.getElementById('close-credits').onclick = () => document.getElementById('credits-modal').style.display = "none";
document.getElementById('close-dmca').onclick = () => document.getElementById('dmca-modal').style.display = "none";