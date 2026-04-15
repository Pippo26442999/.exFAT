let allGames = [];

async function loadLibrary() {
    try {
        const response = await fetch('exFAT.json?v=' + Date.now());
        allGames = await response.json();
        renderGames(allGames);
    } catch (e) { console.error("Errore JSON:", e); }
}

function renderGames(list) {
    const grid = document.getElementById('game-grid');
    grid.innerHTML = '';
    
    list.forEach(game => {
        let tags = (game.tags || []).map(t => `<span class="game-tag">${t}</span>`).join('');
        let downloadHTML = '';
        
        // Verifica se il gioco ha la struttura a doppi link
        const isDouble = game.standard_akia || game.backport_akia;

        if (isDouble) {
            downloadHTML = `
                <div class="download-section">
                    <p class="ver-label">Standard:</p>
                    <div class="download-container">
                        <a onclick="openDL('${game.standard_akia}', '${game.credits_files}', '')" class="btn-dl">AKIA</a>
                        <a onclick="openDL('${game.standard_viki}', '${game.credits_files}', '')" class="btn-dl">VIKI</a>
                    </div>
                    <p class="ver-label">BackPork Ver:</p>
                    <div class="download-container">
                        <a onclick="openDL('${game.backport_akia}', '${game.credits_files}', '${game.credits_backport || ''}')" class="btn-dl">AKIA</a>
                        <a onclick="openDL('${game.backport_viki}', '${game.credits_files}', '${game.credits_backport || ''}')" class="btn-dl">VIKI</a>
                    </div>
                </div>`;
        } else {
            // Layout VERTICALE per card singola (Senza backport crediti se non presente)
            downloadHTML = `
                <div class="download-section">
                    <div class="download-container vertical">
                        <a onclick="openDL('${game.akia_url}', '${game.credits_files}', '${game.credits_backport || ''}')" class="btn-dl">AKIA</a>
                        <a onclick="openDL('${game.viki_url}', '${game.credits_files}', '${game.credits_backport || ''}')" class="btn-dl">VIKI</a>
                    </div>
                </div>`;
        }

        grid.innerHTML += `
            <div class="game-card">
                <span class="game-title">${game.title}</span>
                <div class="image-container">
                    <img src="${game.image}">
                    <div class="tags-overlay">${tags}</div>
                </div>
                ${downloadHTML}
            </div>`;
    });
}

function openDL(url, fAuth, bAuth) {
    let creditsHTML = `Thanks to <b>${fAuth}</b> for the Files`;
    
    // Mostra il backport solo se effettivamente presente nel JSON
    if (bAuth && bAuth.trim() !== "" && bAuth !== "undefined") {
        creditsHTML += `<br>and <b>${bAuth}</b> for the BackPort`;
    }
    
    document.getElementById('credits-body').innerHTML = creditsHTML;
    document.getElementById('final-download-btn').href = url;
    document.getElementById('pw-instruction').style.display = 'block';
    document.getElementById('pw-final').style.display = 'none';
    document.getElementById('credits-modal').style.display = "block";
}

function revealPassword() {
    document.getElementById('pw-instruction').style.display = 'none';
    document.getElementById('pw-final').style.display = 'block';
}

const sTrigger = document.getElementById('search-trigger');
const sInput = document.getElementById('search-input');
if(sTrigger) sTrigger.onclick = () => { sInput.classList.toggle('active'); sInput.focus(); };
if(sInput) sInput.oninput = (e) => renderGames(allGames.filter(g => g.title.toLowerCase().includes(e.target.value.toLowerCase())));

const dmcaBtn = document.getElementById('dmca-link');
if(dmcaBtn) dmcaBtn.onclick = async () => {
    const res = await fetch('DMCA.json');
    const data = await res.json();
    document.getElementById('dmca-title').innerText = data.title;
    document.getElementById('dmca-body').innerHTML = data.content.map(p => `<p>${p}</p>`).join('');
    document.getElementById('dmca-modal').style.display = "block";
};

document.getElementById('close-credits').onclick = () => document.getElementById('credits-modal').style.display = "none";
document.getElementById('close-dmca').onclick = () => document.getElementById('dmca-modal').style.display = "none";
window.onclick = (e) => { if(e.target.classList.contains('modal')) e.target.style.display = "none"; };

loadLibrary();