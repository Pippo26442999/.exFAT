let allGames = [];

async function loadLibrary() {
    try {
        const response = await fetch('exFAT.json?v=' + Date.now());
        if (!response.ok) throw new Error("Errore JSON");
        allGames = await response.json();
        renderGames(allGames);
    } catch (e) { console.error("Errore caricamento:", e); }
}

function renderGames(list) {
    const grid = document.getElementById('game-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    list.forEach(game => {
        let tags = (game.tags || []).map(t => `<span class="game-tag">${t}</span>`).join('');
        const hPlayText = (game.how_to_play || "").replace(/'/g, "\\'");
        const dlcCredits = game.credits_dlc || game.credits_dlcs || '';

        // Funzione per creare i bottoni Akia/Viki
        const createBtn = (url, label) => {
            if (!url || url.trim() === "" || url === "undefined") return '';
            return `<a onclick="openDL('${url}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dlcCredits}', '${hPlayText}')" class="btn-dl">${label}</a>`;
        };

        // Generazione sezioni Download
        let dlcBtns = createBtn(game.dlc_akia, 'AKIA') + createBtn(game.dlc_viki, 'VIKI');
        let dlcSection = dlcBtns !== '' ? `<p class="ver-label">DLCs:</p><div class="download-container">${dlcBtns}</div>` : '';

        let downloadHTML = '';
        
        // CASO 1: Doppio Backport (DOOM)
        if (game.backport7xx_akia || game.backport4xx_akia) {
            let bp7 = createBtn(game.backport7xx_akia, 'AKIA') + createBtn(game.backport7xx_viki, 'VIKI');
            let bp4 = createBtn(game.backport4xx_akia, 'AKIA') + createBtn(game.backport4xx_viki, 'VIKI');
            downloadHTML = `<div class="download-section">
                ${bp7 ? `<p class="ver-label">BackPort 7.xx:</p><div class="download-container">${bp7}</div>` : ''}
                ${bp4 ? `<p class="ver-label">BackPort 4.xx:</p><div class="download-container">${bp4}</div>` : ''}
                ${dlcSection}
            </div>`;
        } 
        // CASO 2: Standard + Backport Classico
        else if (game.standard_akia || game.backport_akia) {
            let std = createBtn(game.standard_akia, 'AKIA') + createBtn(game.standard_viki, 'VIKI');
            let bp = createBtn(game.backport_akia, 'AKIA') + createBtn(game.backport_viki, 'VIKI');
            downloadHTML = `<div class="download-section">
                ${std ? `<p class="ver-label">Standard:</p><div class="download-container">${std}</div>` : ''}
                ${bp ? `<p class="ver-label">BackPort Ver:</p><div class="download-container">${bp}</div>` : ''}
                ${dlcSection}
            </div>`;
        } 
        // CASO 3: Link Singolo
        else {
            let main = createBtn(game.akia_url, 'AKIA') + createBtn(game.viki_url, 'VIKI');
            downloadHTML = `<div class="download-section"><div class="download-container" style="margin-top:15px;">${main}</div>${dlcSection}</div>`;
        }

        let genreHTML = game.genre ? `<div style="font-size:0.75rem; opacity:0.6; margin-top:-15px; margin-bottom:15px; text-transform:uppercase; font-weight:700; letter-spacing:1px;">${game.genre}</div>` : '';

        grid.innerHTML += `
            <div class="game-card">
                <span class="game-title">${game.title}</span>
                ${genreHTML}
                <div class="image-container"><img src="${game.image}"><div class="tags-overlay">${tags}</div></div>
                ${downloadHTML}
            </div>`;
    });
}

// Logica Password Globale
window.revealPassword = function() {
    document.getElementById('pw-instruction').style.display = 'none';
    document.getElementById('pw-final').style.display = 'block';
};

function openDL(url, fAuth, bAuth, dAuth, hPlay) {
    let parts = [];
    if (fAuth && fAuth !== "undefined" && fAuth.trim() !== "") parts.push(`<b>${fAuth}</b> for the Files`);
    if (dAuth && dAuth !== "undefined" && dAuth.trim() !== "") parts.push(`<b>${dAuth}</b> for DLCs`);
    if (bAuth && bAuth !== "undefined" && bAuth.trim() !== "") parts.push(`<b>${bAuth}</b> for the BackPort`);

    let creditsText = "Thanks to " + (parts.length > 0 ? parts.join(", ").replace(/, ([^,]*)$/, ' and $1') : "the community.");
    
    let instHTML = "";
    if (hPlay && hPlay !== "undefined" && hPlay.trim() !== "") {
        instHTML = `<div style="margin-top:15px; padding:12px; background:rgba(57,255,20,0.08); border-radius:12px; font-size:0.85rem; color:var(--green-neon); border:1px solid rgba(57,255,20,0.2); text-align:left;"><b>How to Play:</b><br>${hPlay}</div>`;
    } else if (dAuth && dAuth !== "undefined" && dAuth.trim() !== "") {
        instHTML = `<div style="margin-top:15px; padding:12px; background:rgba(0,255,238,0.08); border-radius:12px; font-size:0.85rem; color:var(--cyan-neon); border:1px solid rgba(0,255,238,0.2); text-align:left;"><b>How to Unlock All DLCs:</b><br>Install the title (.exFAT) then the DLC.</div>`;
    }

    document.getElementById('credits-body').innerHTML = `<div>${creditsText}</div>${instHTML}`;
    document.getElementById('final-download-btn').href = url;
    
    // Reset Password
    document.getElementById('pw-instruction').style.display = 'block';
    document.getElementById('pw-final').style.display = 'none';
    document.getElementById('credits-modal').style.display = "block";
}

// Ricerca
const sTrigger = document.getElementById('search-trigger');
const sInput = document.getElementById('search-input');
if(sTrigger) sTrigger.onclick = () => { sInput.classList.toggle('active'); sInput.focus(); };
if(sInput) sInput.oninput = (e) => renderGames(allGames.filter(g => g.title.toLowerCase().includes(e.target.value.toLowerCase())));

// DMCA
const dmcaBtn = document.getElementById('dmca-link');
if(dmcaBtn) dmcaBtn.onclick = async () => {
    try {
        const res = await fetch('DMCA.json');
        const data = await res.json();
        document.getElementById('dmca-title').innerText = data.title;
        document.getElementById('dmca-body').innerHTML = data.content.map(p => `<p>${p}</p>`).join('');
        document.getElementById('dmca-modal').style.display = "block";
    } catch(e) { console.error("Errore DMCA", e); }
};

// Chiusura Modali
document.getElementById('close-credits').onclick = () => { document.getElementById('credits-modal').style.display = "none"; };
document.getElementById('close-dmca').onclick = () => { document.getElementById('dmca-modal').style.display = "none"; };
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = "none"; };

loadLibrary();