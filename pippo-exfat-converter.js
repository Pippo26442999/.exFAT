/**
 * Pippo exFAT to Pegasus Catalog Converter
 * Versione browser - Converte exFAT.json in formato Pegasus
 */

const LINK_LOCK_PASSWORD = "pippo";
const LINK_LOCK_HOST = "pippo26442999.github.io";
const LINK_LOCK_PATH_PREFIX = "/link-lock-pippo/";
const LINK_LOCK_VERSION = "0.0.1";

const GROUP_ORDER = {
  files: 0,
  standard: 1,
  backport: 2,
  backport7xx: 3,
  backport4xx: 4,
  dlc: 5,
  dump: 6,
};

const GROUP_LABELS = {
  files: "",
  standard: "Standard",
  backport: "BackPort",
  backport7xx: "7.xx BackPort",
  backport4xx: "4.xx BackPort",
  dlc: "DLC",
  dump: "Dump",
};

const MIRROR_LABELS = {
  akia: "Akia",
  viki: "Viki",
  data: "Data",
  buzz: "Buzz",
};

const TITLE_ID_RE = /\b([A-Z]{4}\d{5})\b/;
const VERSION_RE = /\bv\d+(?:\.\d+)+\b/i;
const SIZE_RE = /\b(?<value>\d+(?:[.,]\d+)?)\s*(?<unit>ki?b|mi?b|gi?b|ti?b)\b/i;

const SIZE_UNITS = {
  kb: 1024,
  kib: 1024,
  mb: 1024 ** 2,
  mib: 1024 ** 2,
  gb: 1024 ** 3,
  gib: 1024 ** 3,
  tb: 1024 ** 4,
  tib: 1024 ** 4,
};

function base64ToBuffer(base64Str) {
  let normalized = base64Str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  normalized += '='.repeat(padding);
  const binaryString = atob(normalized);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password, salt, iterations = 100000) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt']
  );
}

async function decryptLinkLockUrl(encryptedUrl) {
  const parsed = new URL(encryptedUrl);
  if (parsed.hostname !== LINK_LOCK_HOST || !parsed.pathname.startsWith('/link-lock-pippo/')) {
    throw new Error("not a Pippo Link Lock URL");
  }
  if (!parsed.hash) throw new Error("Link Lock URL has no fragment");
  
  const payload = base64ToBuffer(parsed.hash.slice(1));
  const params = JSON.parse(new TextDecoder().decode(payload));
  
  const encrypted = base64ToBuffer(params.e);
  const salt = params.s ? base64ToBuffer(params.s) : new Uint8Array([236, 231, 167, 249, 207, 95, 201, 235, 164, 98, 246, 26, 176, 174, 72, 249]);
  const iv = params.i ? base64ToBuffer(params.i) : new Uint8Array([255, 237, 148, 105, 6, 255, 123, 202, 115, 130, 16, 116]);
  
  const key = await deriveKey(LINK_LOCK_PASSWORD, salt);
  const ciphertext = encrypted.slice(0, encrypted.length - 16);
  const tag = encrypted.slice(encrypted.length - 16);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv, tagLength: 128 },
    key,
    new Uint8Array([...ciphertext, ...tag])
  );
  
  return new TextDecoder().decode(decrypted);
}

function isLinkLockUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === LINK_LOCK_HOST && parsed.pathname.startsWith('/link-lock-pippo/');
  } catch {
    return false;
  }
}

function cleanString(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u00a0/g, ' ').split(/\s+/).join(' ').trim();
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function titleIdFromTags(tags) {
  for (const tag of tags) {
    const match = tag.match(TITLE_ID_RE);
    if (match) return match[1];
  }
  return null;
}

function versionFromTags(tags) {
  for (const tag of tags) {
    const match = tag.match(VERSION_RE);
    if (match) return match[0];
  }
  return null;
}

function parseSizeBytes(text) {
  if (!text) return null;
  const match = text.match(SIZE_RE);
  if (!match) return null;
  const value = parseFloat(match.groups.value.replace(',', '.'));
  const unit = match.groups.unit.toLowerCase();
  return Math.trunc(value * (SIZE_UNITS[unit] || 0));
}

function formatLabel(value) {
  return value.split(/[_\s-]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}

function splitLinkKey(key) {
  if (key.endsWith('_url')) return ['files', key.slice(0, -'_url'.length)];
  const index = key.lastIndexOf('_');
  if (index !== -1) return [key.slice(0, index) || 'files', key.slice(index + 1)];
  return ['files', key];
}

function linkName(mirror, group) {
  const mirrorLabel = MIRROR_LABELS[mirror.toLowerCase()] || formatLabel(mirror);
  const groupLabel = GROUP_LABELS[group] || formatLabel(group);
  if (!groupLabel || group === 'files') return mirrorLabel;
  return `${groupLabel} - ${mirrorLabel}`;
}

function packageTitle(title, group) {
  const groupLabel = GROUP_LABELS[group] || formatLabel(group);
  if (!groupLabel || group === 'files') return title;
  return `${title} (${groupLabel})`;
}

function packageVersion(tags, group) {
  let version = versionFromTags(tags);
  const groupLabel = GROUP_LABELS[group] || formatLabel(group);
  if (groupLabel && group !== 'standard' && group !== 'files') {
    if (!version) version = groupLabel;
    else if (!version.toLowerCase().includes(`(${groupLabel})`.toLowerCase())) version = `${version} (${groupLabel})`;
  }
  return version || null;
}

function description(item, group) {
  const lines = [];
  const tags = cleanTags(item.tags);
  const size = cleanString(item.size);
  const howToPlay = cleanString(item.how_to_play);
  const groupLabel = GROUP_LABELS[group] || formatLabel(group);
  if (groupLabel && group !== 'files') lines.push(`Package: ${groupLabel}`);
  if (tags.length) lines.push(`Tags: ${tags.join(', ')}`);
  if (size) lines.push(`Size: ${size}`);
  const credits = [];
  if (item.credits_files) credits.push(`Files: ${item.credits_files}`);
  if (item.credits_backport) credits.push(`Backport: ${item.credits_backport}`);
  if (item.credits_dlc || item.credits_dlcs) credits.push(`DLC: ${item.credits_dlc || item.credits_dlcs}`);
  if (credits.length) lines.push(`Credits: ${credits.join('; ')}`);
  if (howToPlay) lines.push(`How to play: ${howToPlay}`);
  return lines.length ? lines.join('\n') : null;
}

async function hashJson(value) {
  const str = JSON.stringify(value);
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function packagesForItem(item, itemNumber, warnings) {
  const packages = [];
  const title = cleanString(item.title);
  const tags = cleanTags(item.tags);
  const titleId = titleIdFromTags(tags);
  
  if (!title) { warnings.push(`item ${itemNumber}: title is required`); return packages; }
  if (!titleId) { warnings.push(`${title}: no PPSA title id found`); return packages; }

  const groupedLinks = new Map();
  const seen = new Set();

  for (const [key, value] of Object.entries(item)) {
    if (typeof value !== 'string' || !isLinkLockUrl(value)) continue;
    const [group, mirror] = splitLinkKey(key);
    let decodedUrl;
    try {
      decodedUrl = await decryptLinkLockUrl(value);
    } catch (error) {
      warnings.push(`${title}: could not decrypt ${key}: ${error.message}`);
      continue;
    }
    const name = linkName(mirror, group);
    const dedupeKey = `${group}\0${name.toLowerCase()}\0${decodedUrl}`;
    if (seen.has(dedupeKey)) continue;
    if (!groupedLinks.has(group)) groupedLinks.set(group, []);
    groupedLinks.get(group).push({ name, url: decodedUrl });
    seen.add(dedupeKey);
  }

  const sortedGroups = [...groupedLinks.entries()].sort(([leftGroup], [rightGroup]) => {
    const leftOrder = GROUP_ORDER[leftGroup] ?? 100;
    const rightOrder = GROUP_ORDER[rightGroup] ?? 100;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return leftGroup.localeCompare(rightGroup);
  }).filter(([, links]) => links.length);

  for (const [group, links] of sortedGroups) {
    packages.push({
      titleId,
      title: packageTitle(title, group),
      version: packageVersion(tags, group),
      category: group === 'dlc' ? 'dlc' : 'game',
      posterUrl: cleanString(item.image) || null,
      description: description(item, group),
      downloadLinks: links,
      sizeBytes: parseSizeBytes(cleanString(item.size))
    });
  }
  return packages;
}

async function convertExFatToPegasus(exFatData) {
  const warnings = [];
  if (!Array.isArray(exFatData)) throw new Error("Pippo catalog must be a JSON array");
  const allPackages = [];
  for (let i = 0; i < exFatData.length; i++) {
    const item = exFatData[i];
    const itemNumber = i + 1;
    if (!item || typeof item !== 'object') { warnings.push(`item ${itemNumber}: expected object`); continue; }
    const packages = await packagesForItem(item, itemNumber, warnings);
    allPackages.push(...packages);
  }
  return {
    catalog: {
      name: "Pippo exFAT",
      version: 1,
      packages: allPackages,
      _generated: new Date().toISOString(),
      _stats: { totalItems: exFatData.length, totalPackages: allPackages.length }
    },
    warnings
  };
}

window.PippoExfatConverter = { convertExFatToPegasus, decryptLinkLockUrl, isLinkLockUrl };