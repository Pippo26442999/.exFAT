let allGames = [];

async function loadLibrary() {
    const grid = document.getElementById('game-grid');
    try {
        const response = await fetch('exFAT.json?v=' + Date.now());
        allGames = await response.json();
        renderGames(allGames);
    } catch (e) { console.error("Errore caricamento dati:", e); }
}

function renderGames(gamesList) {
    const grid = document.getElementById('game-grid');
    grid.innerHTML = '';
    
    gamesList.forEach(game => {
        let tagsHTML = (game.tags || []).map(t => `<span class="game-tag">${t}</span>`).join('');
        
        // Dati per i credits (fallback se mancano nel JSON)
        const filesAuth = game.credits_files || "Community";
        const backAuth = game.credits_backport || "BestPig";

        grid.innerHTML += `
            <div class="card-container">
                <div class="game-card">
                    <span class="game-title">${game.title}</span>
                    <div class="image-container">
                        <img src="${game.image}" alt="${game.title}">
                        <div class="tags-overlay">${tagsHTML}</div>
                    </div>
                    <div class="download-container">
                        <a href="javascript:void(0)" onclick="openCredits('${game.akia_url}', '${filesAuth}', '${backAuth}')" class="btn-dl">AKIA</a>
                        <span style="opacity:0.2">|</span>
                        <a href="javascript:void(0)" onclick="openCredits('${game.viki_url}', '${filesAuth}', '${backAuth}')" class="btn-dl">VIKI</a>
                    </div>
                </div>
            </div>`;
    });
}

// GESTIONE RICERCA
const searchTrigger = document.getElementById('search-trigger');
const searchInput = document.getElementById('search-input');

searchTrigger.addEventListener('click', () => {
    searchInput.classList.toggle('active');
    if (searchInput.classList.contains('active')) searchInput.focus();
});

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allGames.filter(g => g.title.toLowerCase().includes(term));
    renderGames(filtered);
});

// GESTIONE POPUP CREDITS
function openCredits(url, filesAuthor, backportAuthor) {
    const modal = document.getElementById('credits-modal');
    const body = document.getElementById('credits-body');
    const dlBtn = document.getElementById('final-download-btn');

    body.innerHTML = `
        Thanks to <strong>${filesAuthor}</strong> for the Files<br>
        and <strong>${backportAuthor}</strong> for the BackPort.
    `;
    dlBtn.href = url;
    modal.style.display = "block";
}

// GESTIONE POPUP DMCA
async function loadDMCA() {
    const modal = document.getElementById('dmca-modal');
    try {
        const response = await fetch('DMCA.json?v=' + Date.now());
        const data = await response.json();
        document.getElementById('dmca-title').innerText = data.title;
        document.getElementById('dmca-body').innerHTML = data.content.map(p => `<p>${p}</p>`).join('');
        modal.style.display = "block";
    } catch (e) { console.error(e); }
}

// CHIUSURA MODALS
document.getElementById('dmca-link').addEventListener('click', loadDMCA);
document.getElementById('close-dmca').onclick = () => document.getElementById('dmca-modal').style.display = "none";
document.getElementById('close-credits').onclick = () => document.getElementById('credits-modal').style.display = "none";

window.onclick = (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = "none";
    }
};

document.addEventListener('DOMContentLoaded', loadLibrary);