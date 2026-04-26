let allGames = [];
let filteredGames = [];
let allUpdates = {}; 
let currentPage = 1;
const itemsPerPage = 21;

const SECRET_HASH = "a2242ead55c94c3deb7cf2340bfef9d5bcaca22dfe66e646745ee4371c633fc8";

// --- INIZIALIZZAZIONE ---
async function init() {
    await loadUpdates();
    await loadLibrary();
    setupDropdown(); // Inizializza il nuovo menu
    
    if (sessionStorage.getItem('unlocked') === SECRET_HASH) {
        document.getElementById('site-lock-overlay')?.remove();
        document.body.style.overflow = 'auto';
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
        if (!response.ok) throw new Error("Errore JSON");
        allGames = await response.json();
        filteredGames = [...allGames];
        renderGames();
    } catch (e) { 
        console.error("Errore caricamento library:", e); 
    }
}

// --- LOGICA PASSWORD ---
async function hashStr(str) {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkSitePassword() {
    const input = document.getElementById('site-pw-input').value;
    const overlay = document.getElementById('site-lock-overlay');
    const errorMsg = document.getElementById('pw-error');
    const lockBox = document.getElementById('lock-box');
    const hashedInput = await hashStr(input);

    if (hashedInput === SECRET_HASH) {
        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.remove();
            sessionStorage.setItem('unlocked', SECRET_HASH);
            document.body.style.overflow = 'auto';
        }, 500);
    } else {
        errorMsg.style.display = 'block';
        lockBox.style.animation = 'none';
        lockBox.offsetHeight; 
        lockBox.style.animation = 'shake 0.3s ease-in-out';
        document.getElementById('site-pw-input').value = '';
    }
}

function startProtection() {
    const observer = new MutationObserver(() => {
        if (sessionStorage.getItem('unlocked') !== SECRET_HASH) {
            if (!document.getElementById('site-lock-overlay')) {
                location.reload();
            }
        }
    });
    observer.observe(document.body, { childList: true });
}

// --- GESTIONE DROPDOWN (NEW) ---
function setupDropdown() {
    const dropdown = document.getElementById('fw-dropdown');
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
            applyFilters(); // Richiama il filtro
        };
    });

    window.addEventListener('click', () => {
        optionsContainer.classList.remove('show');
        dropdown.classList.remove('active');
    });
}

// --- FILTRI ---
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const selectedFW = parseInt(document.getElementById('fw-filter').value, 10);

    filteredGames = allGames.filter(g => {
        const matchesSearch = g.title.toLowerCase().includes(searchTerm);
        let gameFW = 1; 
        if (g.tags) {
            const fwTag = g.tags.find(t => t.match(/(\d+)\.xx/i));
            if (fwTag) {
                gameFW = parseInt(fwTag.match(/(\d+)\.xx/i)[1], 10);
            }
        }
        const matchesFW = gameFW <= selectedFW;
        return matchesSearch && matchesFW;
    });

    currentPage = 1;
    renderGames();
}

// --- RENDERING GRIGLIA ---
function renderGames() {
    const grid = document.getElementById('game-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredGames.slice(startIndex, startIndex + itemsPerPage);

    if (pageItems.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; font-size:1.5rem;">No games found.</p>';
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
        let dlcBtns = createBtn(game.dlc_akia, 'AKIA', true) + createBtn(game.dlc_viki, 'VIKI', true) + createBtn(game.dlc_buzz, 'BUZZ', true);
        let dlcSection = dlcBtns ? `<p class="ver-label"><b>DLCs:</b></p><div class="download-container">${dlcBtns}</div>` : '';

        if (game.backport7xx_akia || game.backport4xx_akia) {
            let bp7 = createBtn(game.backport7xx_akia, 'AKIA') + createBtn(game.backport7xx_viki, 'VIKI') + createBtn(game.backport7xx_buzz, 'BUZZ');
            let bp4 = createBtn(game.backport4xx_akia, 'AKIA') + createBtn(game.backport4xx_viki, 'VIKI') + createBtn(game.backport4xx_buzz, 'BUZZ');
            downloadHTML = `${bp7 ? `<p class="ver-label"><b>BP 7.xx:</b></p><div class="download-container">${bp7}</div>` : ''}${bp4 ? `<p class="ver-label"><b>BP 4.xx:</b></p><div class="download-container">${bp4}</div>` : ''}`;
        } else if (game.standard_akia || game.backport_akia) {
            let std = createBtn(game.standard_akia, 'AKIA') + createBtn(game.standard_viki, 'VIKI') + createBtn(game.standard_buzz, 'BUZZ');
            let bp = createBtn(game.backport_akia, 'AKIA') + createBtn(game.backport_viki, 'VIKI') + createBtn(game.backport_buzz, 'BUZZ');
            downloadHTML = `${std ? `<p class="ver-label"><b>STANDARD:</b></p><div class="download-container">${std}</div>` : ''}${bp ? `<p class="ver-label"><b>BACKPORT:</b></p><div class="download-container">${bp}</div>` : ''}`;
        } else {
            downloadHTML = `<div class="download-container" style="margin-top:15px;">${createBtn(game.akia_url, 'AKIA') + createBtn(game.viki_url, 'VIKI') + createBtn(game.buzz_url, 'BUZZ')}</div>`;
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

// --- MODALE DOWNLOAD ---
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

// --- EVENTI ---
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
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = "none"; };