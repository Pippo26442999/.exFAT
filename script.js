let allGames = [];
let filteredGames = [];
let currentPage = 1;
const itemsPerPage = 20;

async function loadLibrary() {
    try {
        const response = await fetch('exFAT.json?v=' + Date.now());
        allGames = await response.json();
        filteredGames = [...allGames];
        renderGames();
    } catch (e) { console.error("Errore caricamento:", e); }
}

// LOGICA SCROLL PER NAV E BOTTONE KO-FI
window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

function renderGames() {
    const grid = document.getElementById('game-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredGames.slice(startIndex, endIndex);

    pageItems.forEach(game => {
        let tagsHTML = (game.tags || []).map(t => `<span class="game-tag">${t}</span>`).join('');
        const hPlay = (game.how_to_play || "").replace(/'/g, "\\'");
        const dCredits = game.credits_dlc || game.credits_dlcs || '';

        const createBtn = (url, label) => {
            if (!url || url === "undefined" || url.trim() === "") return '';
            return `<a onclick="openDL('${url}', '${game.credits_files || ''}', '${game.credits_backport || ''}', '${dCredits}', '${hPlay}')" class="btn-dl">${label}</a>`;
        };

        let dlcSection = '';
        let dlcBtns = createBtn(game.dlc_akia, 'AKIA') + createBtn(game.dlc_viki, 'VIKI');
        if(dlcBtns) dlcSection = `<p class="ver-label">DLCs:</p><div class="download-container">${dlcBtns}</div>`;

        let mainSection = '';
        if (game.backport7xx_akia || game.backport4xx_akia) {
            let bp7 = createBtn(game.backport7xx_akia, 'AKIA') + createBtn(game.backport7xx_viki, 'VIKI');
            let bp4 = createBtn(game.backport4xx_akia, 'AKIA') + createBtn(game.backport4xx_viki, 'VIKI');
            mainSection = (bp7 ? `<p class="ver-label">BP 7.xx:</p><div class="download-container">${bp7}</div>` : '') + 
                          (bp4 ? `<p class="ver-label">BP 4.xx:</p><div class="download-container">${bp4}</div>` : '');
        } else {
            let std = createBtn(game.standard_akia || game.akia_url, 'AKIA') + createBtn(game.standard_viki || game.viki_url, 'VIKI');
            mainSection = `<div class="download-container" style="margin-top:15px;">${std}</div>`;
        }

        grid.innerHTML += `
            <div class="game-card">
                <span class="game-title">${game.title}</span>
                <div class="image-container">
                    <img src="${game.image}">
                    <div class="tags-overlay">${tagsHTML}</div>
                </div>
                <div class="download-section">${mainSection}${dlcSection}</div>
            </div>`;
    });

    const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
    document.getElementById('page-info').innerText = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
    // window.scrollTo({ top: 0, behavior: 'smooth' }); // Opzionale: togli il commento se vuoi che torni su al cambio pagina
}

document.getElementById('next-page').onclick = () => { currentPage++; renderGames(); };
document.getElementById('prev-page').onclick = () => { currentPage--; renderGames(); };

function openDL(url, fAuth, bAuth, dAuth, hPlay) {
    let parts = [];
    if (fAuth && dAuth && fAuth === dAuth) {
        parts.push(`<b>${fAuth}</b> for the Files with DLC`);
        if (bAuth && bAuth !== fAuth) parts.push(`<b>${bAuth}</b> for the BackPort`);
    } else {
        if (fAuth) parts.push(`<b>${fAuth}</b> for the Files`);
        if (dAuth) parts.push(`<b>${dAuth}</b> for DLCs`);
        if (bAuth) parts.push(`<b>${bAuth}</b> for the BackPort`);
    }
    document.getElementById('credits-body').innerHTML = "Thanks to " + parts.join(", ");
    document.getElementById('final-download-btn').href = url;
    document.getElementById('pw-instruction').style.display = 'block';
    document.getElementById('pw-final').style.display = 'none';
    document.getElementById('credits-modal').style.display = "block";
}

window.revealPassword = () => {
    document.getElementById('pw-instruction').style.display = 'none';
    document.getElementById('pw-final').style.display = 'block';
};

const sTrig = document.getElementById('search-trigger');
const sInp = document.getElementById('search-input');
sTrig.onclick = () => { sInp.classList.toggle('active'); sInp.focus(); };
sInp.oninput = (e) => {
    filteredGames = allGames.filter(g => g.title.toLowerCase().includes(e.target.value.toLowerCase()));
    currentPage = 1;
    renderGames();
};

document.getElementById('dmca-link').onclick = async () => {
    const res = await fetch('DMCA.json');
    const data = await res.json();
    document.getElementById('dmca-title').innerText = data.title;
    document.getElementById('dmca-body').innerHTML = data.content.map(p => `<p>${p}</p>`).join('');
    document.getElementById('dmca-modal').style.display = "block";
};

document.getElementById('close-credits').onclick = () => document.getElementById('credits-modal').style.display = "none";
document.getElementById('close-dmca').onclick = () => document.getElementById('dmca-modal').style.display = "none";
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = "none"; };

loadLibrary();