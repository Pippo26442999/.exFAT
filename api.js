// ============================================================
//  Encryption/Decryption API - Compact Version
//  30-40% shorter links
// ============================================================

// ===== PREVIEW MAP - Only short names =====
const PREVIEW_MAP = {
    'akirabox': 'Akia',
    'vikingfile': 'Viki',
    'filekeeper': 'FileK',
    'datavault': 'Vault',
    'datanodes': 'Data',
    'theditch': 'FileD',
    'link-vault.org': 'MultiParts',
    'fileditchfiles': 'FileD'
};

function getPreviewName(domain) {
    domain = domain.toLowerCase();
    for (const [key, value] of Object.entries(PREVIEW_MAP)) {
        if (domain.includes(key)) {
            return value;
        }
    }
    return '';
}

/**
 * Estrae il nome del servizio dall'hash dell'URL.
 * Es: https://link-vault.org/c/oSl-LbWa#AkiraBox -> "Akia"
 *     https://link-vault.org/c/oSl-LbWa#FileKeeper -> "FileK"
 *     https://link-vault.org/c/oSl-LbWa#DataVaults -> "Vault"
 *     https://link-vault.org/c/oSl-LbWa#DataNodes  -> "Data"
 *
 * IMPORTANTE: ignora 'link-vault.org' per evitare falsi positivi
 * (il nome del servizio è nell'hash, non nel dominio).
 */
function getPreviewNameFromHash(url) {
    try {
        const urlObj = new URL(url);
        let hash = urlObj.hash.replace(/^#/, '').trim();
        if (!hash) return '';

        // Normalizza: minuscolo e rimuovi eventuali caratteri non alfanumerici
        const normalized = hash.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Cerca una corrispondenza nella mappa, ESCLUDENDO 'link-vault.org'
        // perché è il dominio generico, non un servizio specifico
        for (const [key, value] of Object.entries(PREVIEW_MAP)) {
            if (key === 'link-vault.org') continue; // <-- salta il match generico

            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalized.includes(cleanKey) || cleanKey.includes(normalized)) {
                return value;
            }
        }
    } catch {
        // URL non valido
    }
    return '';
}

function extractDomainFromUrl(url) {
    try {
        const urlObj = new URL(url);
        let domain = urlObj.hostname;
        domain = domain.replace(/^www\./, '');
        return domain;
    } catch {
        return null;
    }
}

// ===== DATANODES FAILOVER SYSTEM =====
const DATANODES_DOMAINS = ['datanodes.to', 'datanodes.co'];
const DATANODES_CACHE_KEY = 'datanodes_available_domain';
const DATANODES_CACHE_TTL = 5 * 60 * 1000; // 5 minuti

/**
 * Verifica se un dominio è raggiungibile tramite fetch con timeout.
 * Usa mode: 'no-cors' perché non ci interessa la risposta, solo se il server risponde.
 */
async function isDomainReachable(domain, timeoutMs = 3000) {
    return new Promise((resolve) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            resolve(false);
        }, timeoutMs);

        fetch(`https://${domain}/`, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-store',
            signal: controller.signal
        })
        .then(() => {
            clearTimeout(timeoutId);
            resolve(true);
        })
        .catch(() => {
            clearTimeout(timeoutId);
            resolve(false);
        });
    });
}

/**
 * Restituisce il dominio DataNodes attualmente disponibile.
 * Usa cache in sessionStorage per evitare troppe richieste.
 */
async function getAvailableDatanodesDomain() {
    // Controlla cache
    try {
        const cached = sessionStorage.getItem(DATANODES_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.expires > Date.now() && DATANODES_DOMAINS.includes(parsed.domain)) {
                return parsed.domain;
            }
        }
    } catch {
        // Cache corrotta, ignora
    }

    // Prova ogni dominio in ordine
    for (const domain of DATANODES_DOMAINS) {
        const reachable = await isDomainReachable(domain);
        if (reachable) {
            // Salva in cache
            try {
                sessionStorage.setItem(DATANODES_CACHE_KEY, JSON.stringify({
                    domain: domain,
                    expires: Date.now() + DATANODES_CACHE_TTL
                }));
            } catch {
                // sessionStorage non disponibile
            }
            return domain;
        }
    }

    // Se nessuno è raggiungibile, ritorna il primo come fallback
    return DATANODES_DOMAINS[0];
}

/**
 * Sostituisce il dominio DataNodes nell'URL con quello disponibile.
 */
async function resolveDatanodesUrl(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace(/^www\./, '');

        // Controlla se è un URL DataNodes
        const isDatanodes = DATANODES_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
        if (!isDatanodes) {
            return url;
        }

        const availableDomain = await getAvailableDatanodesDomain();

        // Se il dominio è già quello disponibile, ritorna l'URL originale
        if (hostname === availableDomain) {
            return url;
        }

        // Sostituisci il dominio
        urlObj.hostname = availableDomain;
        return urlObj.toString();
    } catch {
        return url;
    }
}

// ===== COMPRESS PAYLOAD =====
function compressPayload(payload) {
    const compressed = {
        v: payload.v || '0.0.1'
    };

    if (payload.e) compressed.e = payload.e;
    if (payload.s && payload.s !== 'AAAAAAAAAAAAAAAAAAAAAA') {
        compressed.s = payload.s;
    }
    if (payload.i && payload.i !== 'AAAAAAAAAAAAAAAAAAAA') {
        compressed.i = payload.i;
    }
    if (payload.ri === true) compressed.r = 1;
    if (payload.rs === true) compressed.rs = 1;
    if (payload.n) compressed.n = payload.n;

    return compressed;
}

// ===== DECOMPRESS PAYLOAD =====
function decompressPayload(compressed) {
    const payload = {
        v: compressed.v || '0.0.1'
    };

    if (compressed.e) payload.e = compressed.e;
    payload.s = compressed.s || 'AAAAAAAAAAAAAAAAAAAAAA';
    payload.i = compressed.i || 'AAAAAAAAAAAAAAAAAAAA';
    payload.ri = compressed.r === 1;
    payload.rs = compressed.rs === 1 || false;
    if (compressed.n) payload.n = compressed.n;

    return payload;
}

async function encryptData(data, password, options = {}) {
    const { randomIv = true, randomSalt = false } = options;

    // ===== RISOLVI DATANODES PRIMA DI CRIPTARE =====
    try {
        const parsed = JSON.parse(data);
        if (parsed.u) {
            parsed.u = await resolveDatanodesUrl(parsed.u);
            data = JSON.stringify(parsed);
        }
    } catch {
        // Non JSON, procedi normalmente
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    let salt;
    let saltBase64;
    if (randomSalt) {
        salt = crypto.getRandomValues(new Uint8Array(16));
        saltBase64 = btoa(String.fromCharCode(...salt));
    } else {
        saltBase64 = 'AAAAAAAAAAAAAAAAAAAAAA';
    }

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: randomSalt ? salt : new Uint8Array(16),
            iterations: 600000,
            hash: 'SHA-256'
        },
        keyMaterial,
        {
            name: 'AES-GCM',
            length: 256
        },
        false,
        ['encrypt']
    );

    let iv;
    let ivBase64;
    if (randomIv) {
        iv = crypto.getRandomValues(new Uint8Array(12));
        ivBase64 = btoa(String.fromCharCode(...iv));
    } else {
        ivBase64 = 'AAAAAAAAAAAAAAAAAAAA';
    }

    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: randomIv ? iv : new Uint8Array(12)
        },
        key,
        dataBuffer
    );

    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

    // ===== Extract preview name =====
    // PRIORITÀ: prima l'hash (più specifico), poi il dominio
    let previewName = '';
    try {
        const parsed = JSON.parse(data);
        if (parsed.u) {
            // 1) Prova prima dall'hash (es. #AkiraBox, #FileKeeper, ...)
            previewName = getPreviewNameFromHash(parsed.u);

            // 2) Se non trovato, prova dal dominio
            if (!previewName) {
                const domain = extractDomainFromUrl(parsed.u);
                if (domain) {
                    previewName = getPreviewName(domain);
                }
            }
        }
    } catch {
        // Not JSON
    }

    const payload = {
        v: '0.0.1',
        e: encryptedBase64
    };

    if (randomSalt) {
        payload.s = saltBase64;
    }
    if (randomIv) {
        payload.i = ivBase64;
    }
    if (randomIv) payload.r = 1;
    if (randomSalt) payload.rs = 1;
    if (previewName) payload.n = previewName;

    const compressed = compressPayload(payload);

    return btoa(JSON.stringify(compressed));
}

async function decryptData(data, password) {
    const decoder = new TextDecoder();

    const compressed = data;
    const payload = decompressPayload(compressed);

    const encrypted = Uint8Array.from(atob(payload.e), c => c.charCodeAt(0));

    let salt;
    if (payload.s && payload.s !== 'AAAAAAAAAAAAAAAAAAAAAA') {
        salt = Uint8Array.from(atob(payload.s), c => c.charCodeAt(0));
    } else {
        salt = new Uint8Array(16);
    }

    let iv;
    if (payload.i && payload.i !== 'AAAAAAAAAAAAAAAAAAAA') {
        iv = Uint8Array.from(atob(payload.i), c => c.charCodeAt(0));
    } else {
        iv = new Uint8Array(12);
    }

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 600000,
            hash: 'SHA-256'
        },
        keyMaterial,
        {
            name: 'AES-GCM',
            length: 256
        },
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        encrypted
    );

    return decoder.decode(decrypted);
}