async function loadGames() {
    const grid = document.getElementById('game-grid');
    
    try {
        // Aggiungiamo un parametro casuale per evitare che il browser usi una vecchia versione salvata
        const response = await fetch('exFAT.json?v=' + Date.now());
        if (!response.ok) throw new Error("File JSON non trovato");
        
        const games = await response.json();

        // Puliamo la griglia prima di aggiungere i giochi
        grid.innerHTML = '';

        games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card';
            
            card.innerHTML = `
                <span class="game-title">${game.title}</span>
                <img src="${game.image}" alt="${game.title}">
                <div class="download-container">
                    <a href="${game.akia_url}" target="_blank">Akia</a>
                    <span class="divider">|</span>
                    <a href="${game.viki_url}" target="_blank">Viki</a>
                </div>
            `;
            
            grid.appendChild(card);
        });
    } catch (error) {
        console.error("Errore:", error);
        grid.innerHTML = `<p style="color:white;">Errore nel caricamento dei giochi. Controlla la console (F12).</p>`;
    }
}

document.addEventListener('DOMContentLoaded', loadGames);