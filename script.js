/**
 * MOTORE DELLA LIBRERIA - Caricamento dinamico da exFAT.json
 */

async function loadGames() {
    const grid = document.getElementById('game-grid');
    
    try {
        // Fetch del file JSON con parametro anti-cache per GitHub Pages
        const response = await fetch('exFAT.json?v=' + Date.now());
        
        if (!response.ok) {
            throw new Error("Impossibile trovare il file exFAT.json");
        }
        
        const games = await response.json();

        // Puliamo la griglia prima di popolarla
        grid.innerHTML = '';

        games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card';
            
            // Costruzione della card
            // Nota: game.description usa l'operatore || '' per non mostrare "undefined" se il campo è vuoto
            card.innerHTML = `
                <div class="game-card-content">
                    <span class="game-title">${game.title}</span>
                    
                    <div class="game-description">
                        ${game.description || ''}
                    </div>
                    
                    <img src="${game.image}" alt="${game.title}" loading="lazy">
                    
                    <div class="download-container">
                        <a href="${game.akia_url}" target="_blank" class="btn-dl">Akia</a>
                        <span class="divider">|</span>
                        <a href="${game.viki_url}" target="_blank" class="btn-dl">Viki</a>
                    </div>
                </div>
            `;
            
            grid.appendChild(card);
        });

        console.log("Libreria caricata con successo: " + games.length + " giochi.");

    } catch (error) {
        console.error("Errore fatale nello script:", error);
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #ff0055; padding: 50px;">
                <h2>Errore nel caricamento dei dati</h2>
                <p>Assicurati che exFAT.json sia presente e formattato correttamente.</p>
            </div>
        `;
    }
}

// Avvio automatico al caricamento del DOM
document.addEventListener('DOMContentLoaded', loadGames);
