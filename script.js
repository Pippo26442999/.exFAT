let allGames = [];
let filteredGames = [];
let currentPage = 1;
const itemsPerPage = 21;

const SECRET_HASH = "a2242ead55c94c3deb7cf2340bfef9d5bcaca22dfe66e646745ee4371c633fc8";

// Caricamento Library
async function loadLibrary() {
    try {
        const response = await fetch('exFAT.json?v=' + Date.now());
        if (!response.ok) throw new Error("Errore JSON");
        allGames = await response.json();
        filteredGames = [...allGames];
        renderGames();
    } catch (e) { console.error("Errore caricamento:", e); }
}

// Funzione Hash
async function hashStr(str) {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Controllo Password Sito
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

// Anti-Tamper
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

// Rendering Immersivo
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
        
        // --- AGGIUNTA LOGICA SIZE ---
        let sizeHTML = game.size ? `<div class="game-size">${game.size}</div>` : '';
        // ----------------------------

        const hPlay = (game.how_to_play || "").replace(/'/g, "\\'");
        const dCredits = game.credits_dlc || game.credits_dlcs || '';

        const createBtn = (url, label, isDLC = false) => {
            if (!url || url === "undefined" || url.trim() === "") return '';
            return `<a onclick="openDL('${url}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}', ${isDLC})" class="btn-dl">${label}</a>`;
        };

        let downloadHTML = '';
        
        let dlcBtns = createBtn(game.dlc_akia, 'AKIA', true) + 
                      createBtn(game.dlc_viki, 'VIKI', true) + 
                      createBtn(game.dlc_buzz, 'BUZZ', true);
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
                <span class="game-title">${game.title}</span>
                <div class="image-container">
                    <img src="${game.image}" referrerpolicy="no-referrer">
                    <div class="tags-overlay">${tagsHTML}</div>
                    ${sizeHTML} </div>
                <div class="download-section">${downloadHTML}${dlcSection}</div>
            </div>`;
    });

    const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
    const info = document.getElementById('page-info');
    if (info) info.innerText = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

// Inizializzazione
window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('unlocked') === SECRET_HASH) {
        document.getElementById('site-lock-overlay')?.remove();
        document.body.style.overflow = 'auto';
    } else {
        document.body.style.overflow = 'hidden';
        startProtection();
    }
    loadLibrary();
});

// Fix Nav Scrolled
window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (nav) {
        if (window.scrollY > 20) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    }
});

// Paginazione
document.getElementById('next-page').onclick = () => { currentPage++; renderGames(); window.scrollTo(0,0); };
document.getElementById('prev-page').onclick = () => { currentPage--; renderGames(); window.scrollTo(0,0); };

// MODALE DOWNLOAD
function openDL(url, fAuth, bAuth, dAuth, hPlay, isDLC = false) {
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

    let instHTML = "";
    if (isDLC) {
        instHTML = `<div style="margin-top:15px; padding:12px; background:rgba(57,255,20,0.08); border-radius:12px; font-size:0.85rem; color:var(--green-neon); border:1px solid rgba(57,255,20,0.2); text-align:left; line-height:1.4;"><b style="text-transform:uppercase; font-size:0.75rem; display:block; margin-bottom:5px; opacity:0.8;">How to Unlock All DLCs:</b>Install the title (.exFAT) then the DLCs.${playInstructions ? `<br><br><b style="text-transform:uppercase; font-size:0.75rem; display:block; margin-bottom:5px; opacity:0.8;">Extra Info:</b>${playInstructions}` : ''}</div>`;
    } else if (playInstructions) {
        instHTML = `<div style="margin-top:15px; padding:12px; background:rgba(57,255,20,0.08); border-radius:12px; font-size:0.85rem; color:var(--green-neon); border:1px solid rgba(57,255,20,0.2); text-align:left; line-height:1.4;"><b style="text-transform:uppercase; font-size:0.75rem; display:block; margin-bottom:5px; opacity:0.8;">Instructions / How to Play:</b>${playInstructions}</div>`;
    }

    const creditsBody = document.getElementById('credits-body');
    if (creditsBody) creditsBody.innerHTML = `<div style="font-size:1.05rem; line-height:1.5;">${creditsText}</div>${instHTML}`;

    document.getElementById('final-download-btn').href = url;
    document.getElementById('pw-instruction').style.display = 'block';
    document.getElementById('pw-final').style.display = 'none';
    document.getElementById('credits-modal').style.display = "block";
}

window.revealPassword = () => {
    document.getElementById('pw-instruction').style.display = 'none';
    document.getElementById('pw-final').style.display = 'block';
};

// Ricerca
const sTrig = document.getElementById('search-trigger');
const sInp = document.getElementById('search-input');
if(sTrig) sTrig.onclick = () => { sInp.classList.toggle('active'); sInp.focus(); };
if(sInp) sInp.oninput = (e) => {
    filteredGames = allGames.filter(g => g.title.toLowerCase().includes(e.target.value.toLowerCase()));
    currentPage = 1;
    renderGames();
};

// DMCA
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