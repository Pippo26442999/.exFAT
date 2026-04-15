async function loadGames() {
    const grid = document.getElementById('game-grid');
    
    try {
        const response = await fetch('exFAT.json?v=' + Date.now());
        if (!response.ok) throw new Error("JSON non trovato");
        
        const games = await response.json();
        grid.innerHTML = '';

        games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card';
            
            card.innerHTML = `
                <div class="game-card-content">
                    <span class="game-title">${game.title}</span>
                    
                    <img src="${game.image}" alt="${game.title}" loading="lazy">
                    
                    <div class="game-description">
                        ${game.description || ''}
                    </div>
                    
                    <div class="download-container">
                        <a href="${game.akia_url}" target="_blank">Akia</a>
                        <span class="divider">|</span>
                        <a href="${game.viki_url}" target="_blank">Viki</a>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error("Errore:", error);
    }
}

document.addEventListener('DOMContentLoaded', loadGames);
