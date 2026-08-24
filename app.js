/* ==========================================================
   cheat/deck — app logic
   state, rendering, search/filters, favorites, hero animation.
   Depends on data.js being loaded first (CATEGORIES, DATA, OS_META,
   LINUX_GROUPS, FAMILIES, CATEGORY_LABEL_OVERRIDES, labelFor()).
   ========================================================== */
function allDistrosOf(fam){ return fam.groups ? fam.groups.flatMap(g => g.distros) : fam.distros; }
function familyOf(os){ return FAMILIES.find(f => allDistrosOf(f).includes(os)); }
function groupOf(os){ return LINUX_GROUPS.find(g => g.distros.includes(os)); }

function totalCommandCount(){
  return Object.values(DATA).reduce((sum, osData) => {
    return sum + Object.values(osData).reduce((s, items) => s + items.length, 0);
  }, 0);
}
function renderCommandCounts(){
  const total = totalCommandCount();
  const rounded = Math.floor(total / 100) * 100;
  const systemsTotal = Object.keys(DATA).length;
  const heroEl = document.getElementById('heroCmdCount');
  const footerEl = document.getElementById('footerCmdCount');
  const topbarSystemsEl = document.getElementById('topbarSystemsCount');
  const heroSystemsEl = document.getElementById('heroSystemsCount');
  if(heroEl) heroEl.textContent = `${rounded}+ commandes`;
  if(footerEl) footerEl.textContent = `${total} commandes au total`;
  if(topbarSystemsEl) topbarSystemsEl.textContent = systemsTotal;
  const paletteField = document.getElementById('paletteInput');
  if(paletteField) paletteField.placeholder = `chercher une commande dans les ${systemsTotal} systèmes…`;
  const paletteDialog = document.getElementById('paletteOverlay');
  if(paletteDialog) paletteDialog.setAttribute('aria-label', `Recherche globale dans les ${systemsTotal} systèmes`);
  if(heroSystemsEl) heroSystemsEl.textContent = `${systemsTotal} systèmes & outils`;
}

/* ==========================================================
   State
   ========================================================== */
let currentOS = 'debian';
let currentFamily = 'linux';
let currentGroup = 'debian';
let currentCat = 'all';
const STORAGE_KEY = 'cheatdeck_favorites_v2';
function loadFavorites(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }catch(e){ return []; } }
function saveFavorites(list){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }catch(e){} }
let favorites = loadFavorites();
/* La clé d'un favori était l'index de la commande dans data.js : insérer une
   commande au milieu d'une catégorie décalait toutes les étoiles suivantes.
   On dérive maintenant la clé de la commande elle-même, qui ne bouge pas. */
function cmdHash(cmd){
  let h = 5381;
  for(let i = 0; i < cmd.length; i++) h = (((h * 33) ^ cmd.charCodeAt(i)) >>> 0);
  return h.toString(36);
}
function favKey(os, cat, cmd){ return `${os}::${cat}::${cmdHash(String(cmd))}`; }
function isFav(key){ return favorites.some(f => f.key === key); }

/* Reprise des favoris enregistrés avec l'ancien format (…::12) : on
   recalcule la clé à partir de la commande gardée dans le favori. */
function migrateFavorites(){
  let changed = false;
  favorites = favorites.map(fav => {
    if(!fav || !fav.cmd || !fav.key) return fav;
    const parts = String(fav.key).split('::');
    if(parts.length === 3 && /^\d+$/.test(parts[2])){
      changed = true;
      return { ...fav, key: favKey(fav.os, fav.cat, fav.cmd) };
    }
    return fav;
  });
  if(changed) saveFavorites(favorites);
}
migrateFavorites();

/* ==========================================================
   Theme (dark default, light optional — persisted)
   ========================================================== */
const THEME_KEY = 'cheatdeck_theme';
function isLightTheme(){ return document.documentElement.getAttribute('data-theme') === 'light'; }

/* ---- couleurs de marque lisibles ----
   La moitié des couleurs officielles (le noir d'AlmaLinux, le pourpre de
   Devuan, le rouge Debian…) ne passent pas en texte sur un fond sombre.
   On garde la teinte de la marque mais on l'éclaircit juste assez pour
   atteindre le rapport de contraste AA (4.5:1). Les aplats — pastilles,
   bordures, tuiles — gardent eux la couleur exacte de la marque. */
const READABLE_BG = '#0a1725'; // la surface la plus sombre où ces textes s'affichent
const readableCache = new Map();
function relLuminance(hex){
  const c = hex.replace('#','');
  const v = [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16) / 255)
    .map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contrastRatio(a, b){
  const l1 = relLuminance(a), l2 = relLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function hexToHsl(hex){
  const c = hex.replace('#','');
  const r = parseInt(c.substr(0,2),16)/255, g = parseInt(c.substr(2,2),16)/255, b = parseInt(c.substr(4,2),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if(d){
    if(max === r) h = ((g - b) / d) % 6;
    else if(max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if(h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, sat, l];
}
function hslToHex(h, sat, l){
  const c = (1 - Math.abs(2 * l - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x]
    : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
  const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}
function readableColor(hex){
  if(readableCache.has(hex)) return readableCache.get(hex);
  let out = hex;
  if(contrastRatio(hex, READABLE_BG) < 4.5){
    const [h, sat] = hexToHsl(hex);
    for(let l = 0.4; l <= 0.94; l += 0.02){
      const candidate = hslToHex(h, sat, l);
      if(contrastRatio(candidate, READABLE_BG) >= 4.5){ out = candidate; break; }
      out = candidate;
    }
  }
  readableCache.set(hex, out);
  return out;
}
function badgeTextColor(hex){ return isLightTheme() ? 'var(--fg)' : readableColor(hex); }
function initTheme(){
  const saved = (() => { try{ return localStorage.getItem(THEME_KEY); }catch(e){ return null; } })();
  let theme = saved;
  if(theme !== 'light' && theme !== 'dark'){
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    theme = prefersLight ? 'light' : 'dark';
  }
  applyTheme(theme);
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    applyTheme(isLight ? 'dark' : 'light');
    renderOsHead();
    if(activeTag) activateTag(activeTag);
  });
}
function applyTheme(theme){
  if(theme === 'light'){
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  document.getElementById('themeIconDark').style.display = theme === 'light' ? 'none' : 'block';
  document.getElementById('themeIconLight').style.display = theme === 'light' ? 'block' : 'none';
  try{ localStorage.setItem(THEME_KEY, theme); }catch(e){}
}

/* ==========================================================
   Render: OS tabs
   ========================================================== */
const familySwitchEl = document.getElementById('familySwitch');
const groupSwitchEl = document.getElementById('groupSwitch');
const distroSwitchEl = document.getElementById('distroSwitch');

function renderFamilyTabs(){
  familySwitchEl.innerHTML = FAMILIES.map(f => `
    <button type="button" class="family-tab ${f.id === currentFamily ? 'active' : ''}" data-family="${f.id}">
      ${f.label}<span class="family-count">${allDistrosOf(f).length}</span>
    </button>
  `).join('');
}

function renderGroupTabs(){
  const fam = FAMILIES.find(f => f.id === currentFamily);
  if(!fam.groups){
    groupSwitchEl.innerHTML = '';
    groupSwitchEl.classList.add('empty');
    return;
  }
  groupSwitchEl.classList.remove('empty');
  groupSwitchEl.innerHTML = fam.groups.map(g => `
    <button type="button" class="group-tab ${g.id === currentGroup ? 'active' : ''}" data-group="${g.id}">
      ${g.label} <span class="group-count">${g.distros.length}</span>
    </button>
  `).join('');
}

function renderDistroTabs(){
  const fam = FAMILIES.find(f => f.id === currentFamily);
  const distros = fam.groups ? LINUX_GROUPS.find(g => g.id === currentGroup).distros : fam.distros;
  if(distros.length <= 1){
    distroSwitchEl.innerHTML = '';
    distroSwitchEl.classList.add('empty');
    return;
  }
  distroSwitchEl.classList.remove('empty');
  distroSwitchEl.innerHTML = distros.map(os => `
    <button type="button" class="os-tab ${os === currentOS ? 'active' : ''}" data-os="${os}" title="${OS_META[os].label} — ${countCommands(os)} commandes">
      <span class="os-tab-glyph" style="background:${OS_META[os].color}22; color:${badgeTextColor(OS_META[os].color)}; border-color:${OS_META[os].color}55; --tile-color:${OS_META[os].color}">${osIconHtml(os, 20)}</span>
      <span class="os-dot" style="background:${OS_META[os].color}"></span>${OS_META[os].label}
    </button>
  `).join('');
}

const osHeadEl = document.getElementById('osHead');
function hexToRgb(hex){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `${r},${g},${b}`;
}
function countCommands(os){
  const cats = DATA[os];
  if(!cats) return 0;
  return Object.values(cats).reduce((sum, items) => sum + items.length, 0);
}
/* Vrai logo (Simple Icons) si dispo pour cet OS/outil, sinon repli sur le badge texte 2-3 lettres. */
function osIconHtml(os, size){
  const p = typeof OS_ICONS !== 'undefined' ? OS_ICONS[os] : null;
  if(p) return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="${p}"/></svg>`;
  return OS_META[os].glyph;
}
function renderOsHead(){
  const meta = OS_META[currentOS];
  document.documentElement.style.setProperty('--os-accent-rgb', hexToRgb(meta.color));
  osHeadEl.innerHTML = `
    <span class="os-glyph" style="background:${meta.color}22; color:${badgeTextColor(meta.color)}; border-color:${meta.color}55; --tile-color:${meta.color}">${osIconHtml(currentOS, 24)}</span>
    <div>
      <h2>${meta.label}</h2>
      <p>${meta.sub}</p>
    </div>
    <span class="os-cmd-count" title="Nombre de commandes référencées pour ${meta.label}">${countCommands(currentOS)} commandes</span>
    <button type="button" class="os-export-btn" id="exportMdBtn" title="Exporter cette cheatsheet en Markdown" aria-label="Exporter en Markdown">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      <span>.md</span>
    </button>
    <button type="button" class="os-export-btn" id="printBtn" title="Imprimer cette cheatsheet" aria-label="Imprimer">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      <span>Imprimer</span>
    </button>
    <span class="os-badge" style="color:${badgeTextColor(meta.color)}; border-color:${meta.color}55; background:${meta.color}14">${meta.tag}</span>
  `;
  document.getElementById('exportMdBtn').addEventListener('click', () => exportSystemAsMarkdown(currentOS));
  document.getElementById('printBtn').addEventListener('click', () => window.print());
}

/* ==========================================================
   Render: category filters
   ========================================================== */
const catFiltersEl = document.getElementById('catFilters');
function renderCatFilters(){
  const osData = DATA[currentOS];
  const active = CATEGORIES.filter(c => osData[c.id] && osData[c.id].length);
  catFiltersEl.innerHTML = `<button type="button" class="cat-pill ${currentCat === 'all' ? 'active' : ''}" data-cat="all">Tout</button>` +
    active.map(c => `<button type="button" class="cat-pill ${currentCat === c.id ? 'active' : ''}" data-cat="${c.id}"><span class="cat-pill-icon">${iconFor(c.id)}</span>${labelFor(currentOS, c.id, c.label)}</button>`).join('');
}

/* ==========================================================
   Render: content grid
   ========================================================== */
const contentEl = document.getElementById('content');
function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


/* ==========================================================
   Commandes destructrices
   Une cheatsheet sert à copier-coller sans réfléchir : les
   commandes qui ne se rattrapent pas doivent le dire elles-mêmes.
   Le repérage se fait sur la commande, pas sur une annotation à
   maintenir dans data.js — une nouvelle entrée est couverte
   automatiquement. Le premier motif qui correspond gagne, donc les
   cas précis (docker, git, kubectl) passent avant les génériques.
   ========================================================== */
const RISKY_COMMANDS = [
  [/:\(\)\s*\{/, 'Fork bomb : sature la machine jusqu’au redémarrage.'],
  [/\b(terraform|vagrant)\s+destroy\b/, 'Détruit l’infrastructure décrite, sans retour possible.'],
  [/\bkubectl\s+delete\b/, 'Supprime la ressource du cluster immédiatement.'],
  [/\b(docker|podman)\s+[a-z]*\s*prune\b/, 'Supprime tout ce qui n’est pas utilisé, pas seulement l’élément visé.'],
  [/\b(docker|podman)\s+(rm|rmi)\s+-[a-z]*f/, 'Force la suppression, conteneur en marche compris.'],
  [/\bgit\s+push\b.*(--force|-f\b)/, 'Réécrit l’historique distant : les autres clones ne suivront plus.'],
  [/\bgit\s+reset\s+--hard\b/, 'Jette les modifications non validées, sans confirmation.'],
  [/\bgit\s+clean\s+-[a-z]*d/, 'Supprime les fichiers non suivis par Git.'],
  [/\bgit\s+(checkout\s+--|restore)\s/, 'Écrase les modifications locales du fichier : rien ne les rattrape.'],
  [/\bdocker\s+compose\s+down\b[^|]*\s-v\b/, 'Le -v emporte aussi les volumes : les données des bases partent avec.'],
  [/\bcrontab\s+-r\b/, 'Supprime toute la crontab de l’utilisateur, sans confirmation.'],
  [/\bmkfs[.\s]|\bwipefs\b|\bfdisk\b|\bparted\b/, 'Touche à la table de partitions : tout le disque est en jeu.'],
  [/\bdd\s+if=/, 'Écrit directement sur le périphérique, sans filet.'],
  [/>\s*\/dev\/(sd|nvme|disk|mmcblk)/, 'Écrit directement sur un disque.'],
  [/\bshred\b/, 'Effacement irrécupérable, même avec un outil de récupération.'],
  [/\b(userdel|groupdel)\b/, 'Supprime le compte — et son dossier personnel avec -r.'],
  [/\bchmod\s+(-R\s+)?777\b/, 'Ouvre les droits à tout le monde : à éviter hors bac à sable.'],
  [/\b(iptables\s+-F|nft\s+flush)\b/, 'Vide les règles du pare-feu : la machine se retrouve ouverte.'],
  [/\biptables\s+-P\s+\w+\s+DROP/, 'Coupe tout ce qui n’est pas déjà autorisé — y compris la session en cours.'],
  // un essai à blanc (-n / --dry-run) ne supprime rien : pas d'avertissement
  [/\brsync\s+(?![^|]*(?:--dry-run|-[a-z]*n[a-z]*\s))[^|]*--delete/, 'Aligne la destination sur la source : ce qui n’existe plus à la source est supprimé.'],
  [/\bsed\s+-i(?![.\w])/, 'Modifie le fichier sur place : sans suffixe (-i.bak), l’original est perdu.'],
  [/(^|[\s;|&])(sudo\s+|doas\s+)?rm\s+-[a-z]*r/, 'Suppression récursive : ni corbeille, ni confirmation.'],
];
function riskOf(cmd){
  for(const [pattern, warning] of RISKY_COMMANDS){
    if(pattern.test(cmd)) return warning;
  }
  return null;
}
function riskHtml(cmd){
  const warning = riskOf(cmd);
  if(!warning) return '';
  return '<div class="cmd-risk"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>' +
    '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.1"/></svg>' +
    '<span>' + escapeHtml(warning) + '</span></div>';
}

function renderContent(){
  const osData = DATA[currentOS];
  contentEl.innerHTML = CATEGORIES.map(cat => {
    const items = osData[cat.id];
    if(!items || !items.length) return '';
    const label = labelFor(currentOS, cat.id, cat.label);
    const cards = items.map(([action, cmd, note], idx) => {
      const key = favKey(currentOS, cat.id, cmd);
      const starred = isFav(key);
      const searchBlob = normalize(action + ' ' + cmd);
      return `
        <div class="cmd-card ${riskOf(cmd) ? 'risky' : ''}" data-search="${searchBlob.replace(/"/g,'&quot;')}" data-cat="${cat.id}">
          <div class="cmd-top">
            <span class="cmd-action" data-raw="${escapeHtml(action)}">${escapeHtml(action)}</span>
            <span class="cmd-tools">
              <button type="button" class="link-btn" data-link="${cmdHash(cmd)}" data-link-cat="${cat.id}" title="Copier le lien vers cette commande" aria-label="Copier le lien vers cette commande">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>
              </button>
              <button type="button" class="star-btn ${starred ? 'starred' : ''}" data-key="${key}" data-os="${currentOS}" data-cat="${cat.id}" data-idx="${idx}" title="Épingler" aria-label="Épingler">
                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z"/></svg>
              </button>
            </span>
          </div>
          <div class="cmd-tag"><span class="tag-dot" style="background:${OS_META[currentOS].color}"></span>${OS_META[currentOS].label.toUpperCase()}</div>
          <div class="cmd-row">
            <code class="cmd-code" data-raw="${escapeHtml(cmd)}"><span class="prompt">$</span> ${escapeHtml(cmd)}</code>
            <button type="button" class="copy-btn" data-cmd="${escapeHtml(cmd)}" title="Copier" aria-label="Copier">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
          ${riskHtml(cmd)}
          ${note ? `<div class="cmd-note">${escapeHtml(note)}</div>` : ''}
        </div>
      `;
    }).join('');
    return `
      <section class="cat-section" data-cat-section="${cat.id}">
        <div class="cat-head">
          <span class="cat-icon" aria-hidden="true">${iconFor(cat.id)}</span>
          <h3>${label}</h3>
          <span class="cat-count">${items.length}</span>
          <div class="cat-rule"></div>
          <button type="button" class="copy-all-btn" data-cat-copy="${cat.id}" title="Copier toutes les commandes visibles de cette catégorie" aria-label="Copier toute la catégorie">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copier tout</span>
          </button>
        </div>
        <div class="cmd-grid">${cards}</div>
      </section>
    `;
  }).join('');
  applyFilters();
}

/* ==========================================================
   Filters (search + category)
   ========================================================== */
const searchInput = document.getElementById('search');
const matchCount = document.getElementById('matchCount');
const noResults = document.getElementById('noResults');
const recentEl = document.getElementById('recentSearches');

/* ---- fuzzy matching: tolerates small typos ---- */
function levenshtein(a, b){
  if(a === b) return 0;
  if(!a.length) return b.length;
  if(!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for(let j = 0; j <= b.length; j++) dp[0][j] = j;
  for(let i = 1; i <= a.length; i++){
    for(let j = 1; j <= b.length; j++){
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp[a.length][b.length];
}
function normalize(s){
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
// does `token` fuzzily occur inside `text`? exact substring first (fast path),
// then tolerate a small edit distance against any word in the text.
function fuzzyTokenMatch(token, text){
  if(text.includes(token)) return true;
  if(token.length < 3) return false; // too short to fuzz safely
  const threshold = token.length <= 5 ? 1 : 2;
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  return words.some(w => Math.abs(w.length - token.length) <= threshold && levenshtein(token, w) <= threshold);
}
function fuzzyMatch(term, text){
  const tokens = normalize(term).trim().split(/\s+/).filter(Boolean);
  if(!tokens.length) return true;
  return tokens.every(tok => fuzzyTokenMatch(tok, text));
}

/* ---- surlignage des correspondances ----
   normalizeWithMap() garde, pour chaque caractere de la chaine normalisee
   (minuscules, sans accents), l'index du caractere d'origine : c'est ce qui
   permet d'encadrer la portion trouvee dans le texte reel, accents compris. */
function normalizeWithMap(s){
  let norm = '';
  const map = [];
  for(let i = 0; i < s.length; i++){
    const n = normalize(s[i]); // meme regle que la recherche : minuscule + accents retires
    for(let k = 0; k < n.length; k++){ norm += n[k]; map.push(i); }
  }
  return { norm, map };
}
function searchTokens(term){
  return normalize(term).trim().split(/\s+/).filter(Boolean);
}
// Renvoie du HTML echappe ou chaque occurrence exacte d'un token est entouree
// de <mark>. Les correspondances approximatives (typos) ne sont pas surlignees :
// mieux vaut ne rien marquer que marquer a cote.
function highlight(text, tokens){
  if(!tokens || !tokens.length) return escapeHtml(text);
  const { norm, map } = normalizeWithMap(text);
  const ranges = [];
  for(const tok of tokens){
    if(!tok) continue;
    let from = 0, at;
    while((at = norm.indexOf(tok, from)) !== -1){
      ranges.push([map[at], map[at + tok.length - 1] + 1]);
      from = at + tok.length;
    }
  }
  if(!ranges.length) return escapeHtml(text);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0].slice()];
  for(const r of ranges.slice(1)){
    const last = merged[merged.length - 1];
    if(r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push(r.slice());
  }
  let out = '', cursor = 0;
  for(const [start, end] of merged){
    out += escapeHtml(text.slice(cursor, start)) + '<mark class="hl">' + escapeHtml(text.slice(start, end)) + '</mark>';
    cursor = end;
  }
  return out + escapeHtml(text.slice(cursor));
}
// Repeint une carte visible. La signature evite de refaire le travail quand
// les tokens n'ont pas bouge (changement de categorie, par exemple).
function paintCard(card, tokens){
  const sig = tokens.join(' ');
  if(card.dataset.hlSig === sig) return;
  card.dataset.hlSig = sig;
  const actionEl = card.querySelector('.cmd-action');
  const codeEl = card.querySelector('.cmd-code');
  if(actionEl) actionEl.innerHTML = highlight(actionEl.dataset.raw, tokens);
  if(codeEl) codeEl.innerHTML = '<span class="prompt">$</span> ' + highlight(codeEl.dataset.raw, tokens);
}

function applyFilters(){
  const raw = searchInput.value.trim();
  const term = normalize(raw);
  const tokens = term ? searchTokens(raw) : [];
  const cards = document.querySelectorAll('.cmd-card');
  let visible = 0;

  cards.forEach(card => {
    const matchesSearch = !term || fuzzyMatch(term, card.dataset.search);
    const matchesCat = currentCat === 'all' || card.dataset.cat === currentCat;
    const show = matchesSearch && matchesCat;
    card.classList.toggle('hidden', !show);
    if(show){ visible++; paintCard(card, tokens); }
  });

  document.querySelectorAll('.cat-section').forEach(sec => {
    const visibleCards = sec.querySelectorAll('.cmd-card:not(.hidden)');
    sec.style.display = visibleCards.length === 0 ? 'none' : '';
  });

  matchCount.textContent = term ? `${visible} résultat${visible !== 1 ? 's' : ''}` : '';
  noResults.classList.toggle('show', visible === 0 && !!term);
}

/* ---- recent searches (persisted, shown when the field is focused & empty) ---- */
const RECENT_KEY = 'cheatdeck_recent_searches';
function loadRecent(){ try{ return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }catch(e){ return []; } }
function saveRecent(list){ try{ localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6))); }catch(e){} }
let recentSearches = loadRecent();

function commitRecentSearch(term){
  term = term.trim();
  if(term.length < 2) return;
  recentSearches = [term, ...recentSearches.filter(t => t.toLowerCase() !== term.toLowerCase())].slice(0, 6);
  saveRecent(recentSearches);
}

function renderRecent(){
  if(!recentSearches.length){ recentEl.classList.remove('show'); return; }
  recentEl.innerHTML = `<div class="recent-searches-label">RECHERCHES RÉCENTES</div>` +
    recentSearches.map(t => `
      <button type="button" class="recent-item" data-term="${escapeHtml(t)}">
        <span>${escapeHtml(t)}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M7 7l10 10"/></svg>
      </button>
    `).join('');
  recentEl.classList.add('show');
}

function debounce(fn, wait){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
const debouncedApplyFilters = debounce(applyFilters, 80);
searchInput.addEventListener('input', debouncedApplyFilters);
searchInput.addEventListener('focus', () => { if(!searchInput.value.trim()) renderRecent(); });
searchInput.addEventListener('blur', () => {
  if(searchInput.value.trim()) commitRecentSearch(searchInput.value);
  setTimeout(() => recentEl.classList.remove('show'), 150);
});
recentEl.addEventListener('mousedown', (e) => {
  const btn = e.target.closest('.recent-item');
  if(!btn) return;
  searchInput.value = btn.dataset.term;
  applyFilters();
  recentEl.classList.remove('show');
});

catFiltersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-pill');
  if(!btn) return;
  currentCat = btn.dataset.cat;
  catFiltersEl.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
  setHash(false);
});

/* ==========================================================
   Family + group + distro switching
   ========================================================== */
function switchTo(os, scroll, cat){
  currentOS = os;
  currentFamily = familyOf(os).id;
  const g = groupOf(os);
  currentGroup = g ? g.id : null;
  currentCat = (cat && DATA[os][cat]) ? cat : 'all';
  searchInput.value = '';
  if(activeTag){ activeTag = null; tagResultsEl.classList.remove('show'); toggleNormalNav(true); renderTagBar(); }
  renderFamilyTabs();
  renderGroupTabs();
  renderDistroTabs();
  renderOsHead();
  renderCatFilters();
  renderContent();
  setHash(false);
  if(scroll) document.querySelector('.deck-anchor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.cheatdeckSwitchTo = switchTo;

/* ==========================================================
   Deep links — the URL hash mirrors the current system/category
   (#docker or #docker/compose) so a view can be bookmarked or
   shared. Plain anchors (#hero, #deck, #top) aren't OS ids, so
   they fall through untouched and keep their native scroll behavior.
   ========================================================== */
/* Met en évidence la carte visée par un lien direct, une fois le deck rendu. */
function flashCommand(hash){
  if(!hash) return;
  const card = [...document.querySelectorAll('.cmd-card')]
    .find(c => c.querySelector('.link-btn')?.dataset.link === hash);
  if(!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 1500);
}

function currentHashTarget(){
  return currentOS + (currentCat !== 'all' ? '/' + currentCat : '');
}
function setHash(replace){
  const target = currentHashTarget();
  const current = location.hash.slice(1);
  if(current === target) return;
  // un lien de commande pointe déjà sur le bon système/catégorie : on le garde
  if(current.split('/').length === 3 && current.startsWith(target + '/')) return;
  if(replace) history.replaceState(null, '', '#' + target);
  else location.hash = target;
}
let pendingCommandHash = null;
function resolveInitialState(){
  const raw = location.hash.slice(1);
  if(!raw) return false;
  const [os, cat, hash] = raw.split('/');
  if(!OS_META[os] || !DATA[os]) return false;
  currentOS = os;
  currentFamily = familyOf(os).id;
  const g = groupOf(os);
  currentGroup = g ? g.id : null;
  currentCat = (cat && DATA[os][cat]) ? cat : 'all';
  pendingCommandHash = hash || null;
  return true;
}
function applyHash(){
  const raw = location.hash.slice(1);
  if(!raw) return;
  const [os, cat] = raw.split('/');
  if(!OS_META[os] || !DATA[os]) return; // not an OS route — leave native anchors alone
  const resolvedCat = (cat && DATA[os][cat]) ? cat : 'all';
  const hash = raw.split('/')[2];
  if(os === currentOS && resolvedCat === currentCat){
    flashCommand(hash);
    return;
  }
  switchTo(os, true, resolvedCat);
  if(hash) setTimeout(() => flashCommand(hash), 350);
}
window.addEventListener('hashchange', applyHash);

/* ==========================================================
   Keyboard navigation between systems (← →) — cycles through the
   distros of the currently visible group/family, same list shown
   in the distro switcher.
   ========================================================== */
function currentDistroList(){
  const fam = FAMILIES.find(f => f.id === currentFamily);
  return fam.groups ? LINUX_GROUPS.find(g => g.id === currentGroup).distros : fam.distros;
}
function navigateOS(direction){
  const list = currentDistroList();
  if(list.length <= 1) return;
  const idx = list.indexOf(currentOS);
  if(idx === -1) return;
  const next = list[(idx + direction + list.length) % list.length];
  switchTo(next, false);
}
// Vrai des qu'une modale est ouverte : les raccourcis globaux (fleches, R…)
// ne doivent pas agir sur la page qui se trouve derriere.
function anyOverlayOpen(){
  return !!document.querySelector('.saved-overlay.open, .compare-overlay.open, .palette-overlay.open, .shortcuts-overlay.open, .drill-overlay.open');
}

familySwitchEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.family-tab');
  if(!btn) return;
  const fam = FAMILIES.find(f => f.id === btn.dataset.family);
  const firstOS = fam.groups ? fam.groups[0].distros[0] : fam.distros[0];
  switchTo(firstOS, true);
});

groupSwitchEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.group-tab');
  if(!btn) return;
  const group = LINUX_GROUPS.find(g => g.id === btn.dataset.group);
  switchTo(group.distros[0], true);
});

distroSwitchEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.os-tab');
  if(!btn) return;
  switchTo(btn.dataset.os, true);
});

/* ==========================================================
   Thematic tag bar — cross-cutting filter independent of the
   family/group/distro lineage (e.g. "gaming" spans several groups).
   ========================================================== */
const FEATURED_TAGS = ['gaming', 'serveur', 'débutant', 'sécurité', 'performance', 'léger', 'desktop', 'dev', 'rolling', 'entreprise', 'conteneurs', 'homelab'];
const tagBarEl = document.getElementById('tagBar');
const tagResultsEl = document.getElementById('tagResults');
let activeTag = null;

function renderTagBar(){
  tagBarEl.innerHTML = `<span class="tag-bar-label">FILTRER PAR USAGE ·</span>` +
    FEATURED_TAGS.map(t => `<button type="button" class="tag-pill ${t === activeTag ? 'active' : ''}" data-tag="${t}">${t}</button>`).join('');
}

function distrosForTag(tag){
  return Object.keys(OS_META).filter(os => OS_META[os].tags && OS_META[os].tags.includes(tag));
}

function toggleNormalNav(show){
  [familySwitchEl, groupSwitchEl, distroSwitchEl, osHeadEl, document.querySelector('.controls'), contentEl, noResults]
    .forEach(el => { if(el) el.style.display = show ? '' : 'none'; });
}

function activateTag(tag){
  activeTag = tag;
  renderTagBar();
  toggleNormalNav(false);
  const matches = distrosForTag(tag);
  tagResultsEl.innerHTML = `
    <div class="tag-results-head">
      <button type="button" id="clearTagBtn">← Retour à l'explorateur</button>
      <span>${matches.length} système${matches.length !== 1 ? 's' : ''} taggé${matches.length !== 1 ? 's' : ''} "${tag}"</span>
    </div>
    <div class="tag-results-grid">
      ${matches.map(os => `
        <button type="button" class="tag-result-card" data-os="${os}">
          <span class="tag-result-glyph" style="background:${OS_META[os].color}22; color:${badgeTextColor(OS_META[os].color)}; border-color:${OS_META[os].color}55; --tile-color:${OS_META[os].color}">${osIconHtml(os, 17)}</span>
          <span>
            <div class="tag-result-name">${OS_META[os].label}</div>
            <div class="tag-result-sub">${OS_META[os].sub}</div>
          </span>
        </button>
      `).join('')}
    </div>
  `;
  tagResultsEl.classList.add('show');
}

function clearTagView(){
  activeTag = null;
  tagResultsEl.classList.remove('show');
  toggleNormalNav(true);
  renderTagBar();
}

tagBarEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tag-pill');
  if(!btn) return;
  const tag = btn.dataset.tag;
  if(tag === activeTag){ clearTagView(); } else { activateTag(tag); }
});

tagResultsEl.addEventListener('click', (e) => {
  if(e.target.closest('#clearTagBtn')){ clearTagView(); return; }
  const card = e.target.closest('.tag-result-card');
  if(card){ switchTo(card.dataset.os, true); }
});

/* ==========================================================
   Copy to clipboard + toast
   ========================================================== */
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

function unescapeCmd(s){
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
}

async function copyCmd(cmd, btn, message){
  try{
    await navigator.clipboard.writeText(cmd);
  }catch(err){
    const ta = document.createElement('textarea');
    ta.value = cmd; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }
  if(btn){
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 900);
  }
  showToast(message || 'Commande copiée');
}

/* Lien direct vers une commande : #systeme/categorie/empreinte. L'empreinte
   est celle de la commande elle-même, donc le lien survit à l'ajout d'une
   commande au-dessus — comme les favoris. */
function commandLink(os, cat, hash){
  return location.origin + location.pathname + '#' + os + '/' + cat + '/' + hash;
}

contentEl.addEventListener('click', (e) => {
  const linkBtn = e.target.closest('.link-btn');
  if(linkBtn){
    copyCmd(commandLink(currentOS, linkBtn.dataset.linkCat, linkBtn.dataset.link), linkBtn, 'Lien de la commande copié');
    return;
  }
  const copyBtn = e.target.closest('.copy-btn');
  if(copyBtn){
    copyCmd(unescapeCmd(copyBtn.dataset.cmd), copyBtn);
    return;
  }
  const starBtn = e.target.closest('.star-btn');
  if(starBtn){
    toggleFavorite(starBtn);
    return;
  }
  const copyAllBtn = e.target.closest('.copy-all-btn');
  if(copyAllBtn){
    copyAllInSection(copyAllBtn);
  }
});

function copyAllInSection(btn){
  const section = btn.closest('.cat-section');
  const visibleCodes = [...section.querySelectorAll('.cmd-card:not(.hidden) .cmd-code')]
    .map(el => unescapeCmd(el.textContent.replace(/^\$\s*/, '').trim()));
  if(!visibleCodes.length) return;
  copyCmd(visibleCodes.join('\n'), btn);
  btn.classList.add('copied');
  setTimeout(() => btn.classList.remove('copied'), 900);
}

/* ==========================================================
   Export: system cheatsheet as Markdown file
   ========================================================== */
function exportSystemAsMarkdown(os){
  const meta = OS_META[os];
  const cats = DATA[os];
  if(!meta || !cats) return;
  let md = `# ${meta.label} — cheat/deck\n\n${meta.sub}\n\n`;
  for(const cat of CATEGORIES){
    const items = cats[cat.id];
    if(!items || !items.length) continue;
    md += `## ${labelFor(os, cat.id, cat.label)}\n\n`;
    for(const [action, cmd, note] of items){
      md += `- **${action}**\n  \`\`\`\n  ${cmd}\n  \`\`\`\n`;
      if(note) md += `  > ${note}\n`;
    }
    md += `\n`;
  }
  md += `---\nGénéré depuis cheat/deck — ${countCommands(os)} commandes.\n`;
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cheatdeck-${os}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
/* ==========================================================
   Favorites (cross-OS "Saved" view)
   ========================================================== */
const savedCountEl = document.getElementById('savedCount');
const savedHeadCountEl = document.getElementById('savedHeadCount');

function toggleFavorite(btn){
  const { key, os, cat, idx } = btn.dataset;
  const existing = favorites.findIndex(f => f.key === key);
  if(existing >= 0){
    favorites.splice(existing, 1);
    btn.classList.remove('starred');
  }else{
    const item = DATA[os][cat][idx];
    favorites.push({ key, os, cat, action: item[0], cmd: item[1] });
    btn.classList.add('starred');
  }
  saveFavorites(favorites);
  updateSavedCount();
  renderSavedList();
}

function updateSavedCount(){
  savedCountEl.textContent = favorites.length;
  savedHeadCountEl.textContent = `(${favorites.length})`;
}

function renderSavedList(){
  const listEl = document.getElementById('savedList');
  const emptyEl = document.getElementById('savedEmpty');
  if(!favorites.length){
    listEl.innerHTML = '';
    emptyEl.classList.add('show');
    return;
  }
  emptyEl.classList.remove('show');
  listEl.innerHTML = favorites.map(f => `
    <div class="saved-item">
      <div class="saved-item-top">
        <span class="saved-item-os"><span class="tag-dot" style="background:${OS_META[f.os].color}"></span>${OS_META[f.os].label}</span>
        <button type="button" class="star-btn starred" data-key="${f.key}" title="Retirer" aria-label="Retirer">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z"/></svg>
        </button>
      </div>
      <div class="saved-item-action">${f.action}</div>
      <div class="cmd-row">
        <code class="cmd-code"><span class="prompt">$</span> ${escapeHtml(f.cmd)}</code>
        <button type="button" class="copy-btn" data-cmd="${escapeHtml(f.cmd)}" title="Copier" aria-label="Copier">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
      ${riskHtml(f.cmd)}
    </div>
  `).join('');
}

// Piège de focus minimal pour les modales : empêche Tab/Maj+Tab de sortir
// du panneau tant qu'il est ouvert (accessibilité clavier).
function trapFocus(e, overlay){
  if(e.key !== 'Tab') return;
  const focusables = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if(!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
}

const savedOverlay = document.getElementById('savedOverlay');
let savedLastFocus = null;
document.getElementById('savedToggle').addEventListener('click', (e) => {
  savedLastFocus = e.currentTarget;
  renderSavedList();
  savedOverlay.classList.add('open');
  document.body.classList.add('lock-scroll');
  document.getElementById('closeSaved').focus();
});
function closeSaved(){
  if(!savedOverlay.classList.contains('open')) return;
  savedOverlay.classList.remove('open');
  document.body.classList.remove('lock-scroll');
  savedLastFocus?.focus();
}
document.getElementById('closeSaved').addEventListener('click', closeSaved);
savedOverlay.addEventListener('click', (e) => { if(e.target === savedOverlay) closeSaved(); });
savedOverlay.addEventListener('keydown', (e) => trapFocus(e, savedOverlay));
document.getElementById('copyAllSaved').addEventListener('click', (e) => {
  if(!favorites.length) return;
  copyCmd(favorites.map(f => f.cmd).join('\n'), e.currentTarget);
});

/* ---- export / import favorites as JSON — the only cross-device sync
   possible without a backend: the user carries the file themselves. ---- */
function exportFavorites(){
  if(!favorites.length){ showToast('Aucun favori à exporter'); return; }
  const blob = new Blob([JSON.stringify(favorites, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cheatdeck-favoris.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Favoris exportés');
}
function importFavoritesFromFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    let incoming;
    try{ incoming = JSON.parse(reader.result); }
    catch(e){ showToast('Fichier JSON invalide'); return; }
    if(!Array.isArray(incoming)){ showToast('Fichier JSON invalide'); return; }
    let added = 0;
    incoming.forEach(item => {
      const valid = item && typeof item.key === 'string' && typeof item.action === 'string' && typeof item.cmd === 'string'
        && OS_META[item.os] && DATA[item.os] && DATA[item.os][item.cat];
      if(!valid || favorites.some(f => f.key === item.key)) return;
      favorites.push({ key: item.key, os: item.os, cat: item.cat, action: item.action, cmd: item.cmd });
      added++;
    });
    if(added){
      saveFavorites(favorites);
      updateSavedCount();
      renderSavedList();
      document.querySelectorAll('.star-btn').forEach(btn => {
        if(isFav(btn.dataset.key)) btn.classList.add('starred');
      });
    }
    showToast(added ? `${added} favori${added > 1 ? 's' : ''} importé${added > 1 ? 's' : ''}` : 'Rien de nouveau à importer');
  };
  reader.readAsText(file);
}
document.getElementById('exportSaved').addEventListener('click', exportFavorites);
document.getElementById('importSaved').addEventListener('click', () => document.getElementById('importSavedFile').click());
document.getElementById('importSavedFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(file) importFavoritesFromFile(file);
  e.target.value = '';
});

document.getElementById('savedList').addEventListener('click', (e) => {
  const copyBtn = e.target.closest('.copy-btn');
  if(copyBtn){
    copyCmd(unescapeCmd(copyBtn.dataset.cmd), copyBtn);
    return;
  }
  const starBtn = e.target.closest('.star-btn');
  if(starBtn){
    const key = starBtn.dataset.key;
    favorites = favorites.filter(f => f.key !== key);
    saveFavorites(favorites);
    updateSavedCount();
    renderSavedList();
    const mainStar = document.querySelector(`.star-btn[data-key="${key}"]`);
    if(mainStar) mainStar.classList.remove('starred');
  }
});

/* ==========================================================
   Compare view (side-by-side, two systems, category by category)
   ========================================================== */
const compareOverlay = document.getElementById('compareOverlay');
const compareASel = document.getElementById('compareA');
const compareBSel = document.getElementById('compareB');
const compareBodyEl = document.getElementById('compareBody');

function populateCompareSelects(){
  const options = Object.keys(OS_META)
    .sort((a, b) => OS_META[a].label.localeCompare(OS_META[b].label))
    .map(os => `<option value="${os}">${OS_META[os].label}</option>`).join('');
  compareASel.innerHTML = options;
  compareBSel.innerHTML = options;
}

function compareItemHtml(action, cmd){
  const esc = escapeHtml(cmd);
  return `
    <div class="compare-item">
      <div class="compare-item-action">${action}</div>
      <div class="cmd-row">
        <code class="cmd-code"><span class="prompt">$</span> ${esc}</code>
        <button type="button" class="copy-btn" data-cmd="${esc}" title="Copier" aria-label="Copier">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderCompare(){
  const osA = compareASel.value, osB = compareBSel.value;
  const metaA = OS_META[osA], metaB = OS_META[osB];
  const dataA = DATA[osA] || {}, dataB = DATA[osB] || {};
  const cats = CATEGORIES.filter(c => (dataA[c.id] && dataA[c.id].length) || (dataB[c.id] && dataB[c.id].length));

  if(!cats.length){
    compareBodyEl.innerHTML = `<div class="compare-none">Rien à comparer entre ces deux systèmes.</div>`;
    return;
  }

  const headers = `
    <div class="compare-col-headers">
      <span style="color:${badgeTextColor(metaA.color)}"><span class="tag-dot" style="background:${metaA.color}"></span>${metaA.label}</span>
      <span style="color:${badgeTextColor(metaB.color)}"><span class="tag-dot" style="background:${metaB.color}"></span>${metaB.label}</span>
    </div>
  `;

  const body = cats.map(cat => {
    const itemsA = dataA[cat.id] || [];
    const itemsB = dataB[cat.id] || [];
    const colA = itemsA.length ? itemsA.map(([action, cmd]) => compareItemHtml(action, cmd)).join('') : `<div class="compare-empty">— pas de commandes dans cette catégorie —</div>`;
    const colB = itemsB.length ? itemsB.map(([action, cmd]) => compareItemHtml(action, cmd)).join('') : `<div class="compare-empty">— pas de commandes dans cette catégorie —</div>`;
    return `
      <div class="compare-cat">
        <div class="compare-cat-head">
          <span class="cat-icon" aria-hidden="true">${iconFor(cat.id)}</span>
          <h3>${labelFor(osA, cat.id, cat.label)}</h3>
        </div>
        <div class="compare-cols">
          <div class="compare-col">${colA}</div>
          <div class="compare-col">${colB}</div>
        </div>
      </div>
    `;
  }).join('');

  compareBodyEl.innerHTML = headers + body;
}

let compareLastFocus = null;
function openCompare(){
  compareLastFocus = document.activeElement;
  compareASel.value = currentOS;
  compareBSel.value = currentOS === 'ubuntu' ? 'arch' : 'ubuntu';
  renderCompare();
  compareOverlay.classList.add('open');
  document.body.classList.add('lock-scroll');
  document.getElementById('closeCompare').focus();
}
function closeCompare(){
  if(!compareOverlay.classList.contains('open')) return;
  compareOverlay.classList.remove('open');
  document.body.classList.remove('lock-scroll');
  compareLastFocus?.focus();
}

populateCompareSelects();
document.getElementById('compareToggle').addEventListener('click', openCompare);
document.getElementById('closeCompare').addEventListener('click', closeCompare);
compareOverlay.addEventListener('click', (e) => { if(e.target === compareOverlay) closeCompare(); });
compareOverlay.addEventListener('keydown', (e) => trapFocus(e, compareOverlay));
compareASel.addEventListener('change', renderCompare);
compareBSel.addEventListener('change', renderCompare);
document.getElementById('compareSwap').addEventListener('click', () => {
  const a = compareASel.value;
  compareASel.value = compareBSel.value;
  compareBSel.value = a;
  renderCompare();
});
compareBodyEl.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('.copy-btn');
  if(copyBtn) copyCmd(unescapeCmd(copyBtn.dataset.cmd), copyBtn);
});

/* ==========================================================
   Command palette (Ctrl+K) — fuzzy search across the 4800+
   commands of all 47 systems at once, not just the open one.
   ========================================================== */
let globalIndex = null;
function buildGlobalIndex(){
  if(globalIndex) return globalIndex;
  globalIndex = [];
  for(const os of Object.keys(DATA)){
    const cats = DATA[os];
    for(const catId of Object.keys(cats)){
      cats[catId].forEach(([action, cmd, note], idx) => {
        globalIndex.push({ os, cat: catId, idx, action, cmd, note, blob: normalize(`${action} ${cmd} ${OS_META[os].label}`) });
      });
    }
  }
  return globalIndex;
}

const paletteOverlay = document.getElementById('paletteOverlay');
const paletteInput = document.getElementById('paletteInput');
const paletteResultsEl = document.getElementById('paletteResults');
const paletteEmptyEl = document.getElementById('paletteEmpty');
const PALETTE_LIMIT = 60;
const paletteCountEl = document.getElementById('paletteCount');
let paletteMatches = [];
let paletteSelected = 0;
let paletteTokens = [];
let paletteLastFocus = null;

function paletteRowHtml(item, i){
  return `
    <button type="button" class="palette-row ${i === paletteSelected ? 'active' : ''}" data-index="${i}">
      <span class="palette-row-os" style="color:${badgeTextColor(OS_META[item.os].color)}"><span class="tag-dot" style="background:${OS_META[item.os].color}"></span>${OS_META[item.os].label}</span>
      <span class="palette-row-action">${highlight(item.action, paletteTokens)}</span>
      <code class="palette-row-cmd">${highlight(item.cmd, paletteTokens)}</code>
    </button>
  `;
}

/* Classement des resultats : sans score, la palette renvoyait les commandes
   dans l'ordre du fichier de donnees (Debian d'abord, toujours). On privilegie
   ce qui commence par le terme cherche, puis le systeme actuellement ouvert,
   et a pertinence egale la commande la plus courte. */
function paletteScore(item, tokens, term){
  const action = normalize(item.action);
  const cmd = normalize(item.cmd);
  let score = 0;
  if(action.startsWith(term)) score += 120;
  else if(action.includes(term)) score += 70;
  if(cmd.startsWith(term)) score += 100;
  else if(cmd.includes(term)) score += 50;
  for(const tok of tokens){
    if(action.includes(tok)) score += 14;
    if(cmd.includes(tok)) score += 9;
  }
  if(item.os === currentOS) score += 30;
  score -= Math.min(item.cmd.length / 12, 8);
  return score;
}

function runPaletteSearch(){
  const raw = paletteInput.value.trim();
  const term = normalize(raw);
  paletteTokens = term ? searchTokens(raw) : [];
  if(!term){
    paletteMatches = [];
    paletteResultsEl.innerHTML = '';
    paletteResultsEl.classList.remove('show');
    paletteEmptyEl.classList.remove('show');
    paletteCountEl.textContent = '';
    return;
  }
  const hits = buildGlobalIndex().filter(item => fuzzyMatch(term, item.blob));
  hits.sort((a, b) => paletteScore(b, paletteTokens, term) - paletteScore(a, paletteTokens, term));
  paletteMatches = hits.slice(0, PALETTE_LIMIT);
  paletteSelected = 0;
  paletteCountEl.textContent = hits.length > PALETTE_LIMIT
    ? `${PALETTE_LIMIT} sur ${hits.length}`
    : `${hits.length} résultat${hits.length !== 1 ? 's' : ''}`;
  if(!paletteMatches.length){
    paletteResultsEl.innerHTML = '';
    paletteResultsEl.classList.remove('show');
    paletteEmptyEl.classList.add('show');
    return;
  }
  paletteEmptyEl.classList.remove('show');
  paletteResultsEl.classList.add('show');
  paletteResultsEl.innerHTML = paletteMatches.map(paletteRowHtml).join('');
}
const debouncedPaletteSearch = debounce(runPaletteSearch, 60);

function updatePaletteSelection(){
  paletteResultsEl.querySelectorAll('.palette-row').forEach((row, i) => row.classList.toggle('active', i === paletteSelected));
  paletteResultsEl.querySelector('.palette-row.active')?.scrollIntoView({ block: 'nearest' });
}

function jumpToPaletteItem(item){
  closePalette();
  switchTo(item.os, true);
  searchInput.value = item.action;
  applyFilters();
  const key = favKey(item.os, item.cat, item.cmd);
  setTimeout(() => {
    const card = document.querySelector(`.star-btn[data-key="${key}"]`)?.closest('.cmd-card');
    if(card){
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('flash');
      setTimeout(() => card.classList.remove('flash'), 1500);
    }
  }, 450);
}

function openPalette(){
  paletteLastFocus = document.activeElement;
  buildGlobalIndex();
  paletteInput.value = '';
  paletteMatches = [];
  paletteTokens = [];
  paletteCountEl.textContent = '';
  paletteResultsEl.innerHTML = '';
  paletteResultsEl.classList.remove('show');
  paletteEmptyEl.classList.remove('show');
  paletteOverlay.classList.add('open');
  document.body.classList.add('lock-scroll');
  setTimeout(() => paletteInput.focus(), 30);
}
function closePalette(){
  if(!paletteOverlay.classList.contains('open')) return;
  paletteOverlay.classList.remove('open');
  document.body.classList.remove('lock-scroll');
  paletteLastFocus?.focus();
}

paletteInput.addEventListener('input', debouncedPaletteSearch);
paletteOverlay.addEventListener('click', (e) => { if(e.target === paletteOverlay) closePalette(); });
paletteOverlay.addEventListener('keydown', (e) => trapFocus(e, paletteOverlay));
paletteResultsEl.addEventListener('click', (e) => {
  const row = e.target.closest('.palette-row');
  if(row) jumpToPaletteItem(paletteMatches[Number(row.dataset.index)]);
});
paletteInput.addEventListener('keydown', (e) => {
  if(e.key === 'ArrowDown'){
    e.preventDefault();
    if(!paletteMatches.length) return;
    paletteSelected = Math.min(paletteSelected + 1, paletteMatches.length - 1);
    updatePaletteSelection();
  } else if(e.key === 'ArrowUp'){
    e.preventDefault();
    if(!paletteMatches.length) return;
    paletteSelected = Math.max(paletteSelected - 1, 0);
    updatePaletteSelection();
  } else if(e.key === 'Enter'){
    e.preventDefault();
    const item = paletteMatches[paletteSelected];
    if(!item) return;
    // Ctrl/Cmd + Entree : on copie et on reste dans la palette
    if(e.ctrlKey || e.metaKey) copyCmd(item.cmd);
    else jumpToPaletteItem(item);
  } else if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && paletteInput.selectionStart === paletteInput.selectionEnd){
    const item = paletteMatches[paletteSelected];
    if(item){ e.preventDefault(); copyCmd(item.cmd); }
  } else if(e.key === 'Escape'){
    closePalette();
  }
});

document.getElementById('openSearch').addEventListener('click', openPalette);

/* ==========================================================
   Shortcuts help overlay (the "?" key)
   ========================================================== */
const shortcutsOverlay = document.getElementById('shortcutsOverlay');
let shortcutsLastFocus = null;
function openShortcuts(){
  shortcutsLastFocus = document.activeElement;
  shortcutsOverlay.classList.add('open');
  document.body.classList.add('lock-scroll');
  document.getElementById('closeShortcuts').focus();
}
function closeShortcuts(){
  if(!shortcutsOverlay.classList.contains('open')) return;
  shortcutsOverlay.classList.remove('open');
  document.body.classList.remove('lock-scroll');
  shortcutsLastFocus?.focus();
}
document.getElementById('shortcutsToggle').addEventListener('click', openShortcuts);
document.getElementById('closeShortcuts').addEventListener('click', closeShortcuts);
shortcutsOverlay.addEventListener('click', (e) => { if(e.target === shortcutsOverlay) closeShortcuts(); });
shortcutsOverlay.addEventListener('keydown', (e) => trapFocus(e, shortcutsOverlay));


/* ==========================================================
   Mode révision — le hero promet « enfin mémorisée » : ici on
   retourne la carte. L'action sert de question, la commande est
   masquée, et le résultat de chaque carte est gardé en local pour
   faire revenir plus souvent celles qu'on rate.
   ========================================================== */
const DRILL_KEY = 'cheatdeck_drill_v1';
function loadDrillStats(){ try{ return JSON.parse(localStorage.getItem(DRILL_KEY)) || {}; }catch(e){ return {}; } }
function saveDrillStats(){ try{ localStorage.setItem(DRILL_KEY, JSON.stringify(drillStats)); }catch(e){} }
let drillStats = loadDrillStats();

const drillOverlay = document.getElementById('drillOverlay');
const drillSetupEl = document.getElementById('drillSetup');
const drillCardEl = document.getElementById('drillCard');
const drillResultEl = document.getElementById('drillResult');
const drillProgressEl = document.getElementById('drillProgress');
let drillSource = 'os';
let drillLength = 10;
let drillQueue = [];
let drillPos = 0;
let drillMissedList = [];
let drillOkCount = 0;
let drillRevealed = false;
let drillLastFocus = null;

/* Toutes les cartes candidates selon la source choisie. */
function drillCardsFrom(source){
  const out = [];
  if(source === 'saved'){
    for(const fav of favorites){
      const idx = Number(fav.key.split('::')[2]);
      const item = DATA[fav.os] && DATA[fav.os][fav.cat] && DATA[fav.os][fav.cat][idx];
      out.push({ os: fav.os, cat: fav.cat, idx, action: fav.action, cmd: fav.cmd, note: item ? (item[2] || '') : '', key: fav.key });
    }
    return out;
  }
  const systems = source === 'all' ? Object.keys(DATA) : [currentOS];
  for(const os of systems){
    for(const cat of Object.keys(DATA[os])){
      DATA[os][cat].forEach(([action, cmd, note], idx) => {
        out.push({ os, cat, idx, action, cmd, note: note || '', key: favKey(os, cat, cmd) });
      });
    }
  }
  return out;
}

/* Poids d'une carte : une carte ratée revient, une carte sue s'efface. */
function drillWeight(card){
  const st = drillStats[card.key];
  if(!st) return 1.4;
  return Math.max(0.25, Math.min(6, 1 + 2.2 * (st.ko || 0) - 0.7 * (st.ok || 0)));
}
/* Tirage aléatoire pondéré sans remise (Efraimidis–Spirakis). */
function drillPick(pool, n){
  return pool
    .map(card => ({ card, k: Math.pow(Math.random(), 1 / drillWeight(card)) }))
    .sort((a, b) => b.k - a.k)
    .slice(0, n)
    .map(x => x.card);
}

function drillCatLabel(card){
  const cat = CATEGORIES.find(c => c.id === card.cat);
  return cat ? labelFor(card.os, cat.id, cat.label) : card.cat;
}

function renderDrillSetup(){
  const pool = drillCardsFrom(drillSource);
  const info = document.getElementById('drillPoolInfo');
  const startBtn = document.getElementById('drillStart');
  if(!pool.length){
    info.textContent = drillSource === 'saved'
      ? 'Aucun favori à réviser — épingle des commandes d’abord.'
      : 'Aucune commande disponible.';
    startBtn.disabled = true;
  }else{
    const n = Math.min(drillLength, pool.length);
    info.textContent = pool.length + ' commandes disponibles · ' + n + ' tirées';
    startBtn.disabled = false;
  }

  const keys = Object.keys(drillStats);
  const seen = keys.length;
  const mastered = keys.filter(k => (drillStats[k].ok || 0) >= 2 && (drillStats[k].ok || 0) > (drillStats[k].ko || 0)).length;
  const shaky = keys.filter(k => (drillStats[k].ko || 0) >= (drillStats[k].ok || 0) && (drillStats[k].ko || 0) > 0).length;
  const statsEl = document.getElementById('drillStats');
  statsEl.innerHTML = seen
    ? '<span><strong>' + seen + '</strong> cartes vues</span><span><strong>' + mastered + '</strong> maîtrisées</span><span><strong>' + shaky + '</strong> à revoir</span>' +
      '<button type="button" class="drill-reset" id="drillReset">réinitialiser</button>'
    : '<span>Aucune carte révisée pour l’instant.</span>';
  const resetBtn = document.getElementById('drillReset');
  if(resetBtn){
    resetBtn.addEventListener('click', () => {
      // deux temps : le premier clic demande confirmation, le second efface.
      if(resetBtn.dataset.armed){
        drillStats = {};
        saveDrillStats();
        renderDrillSetup();
        showToast('Statistiques de révision effacées');
      }else{
        resetBtn.dataset.armed = '1';
        resetBtn.textContent = 'confirmer ?';
        resetBtn.classList.add('armed');
      }
    });
  }
}

function showDrillScreen(name){
  drillSetupEl.classList.toggle('show', name === 'setup');
  drillCardEl.classList.toggle('show', name === 'card');
  drillResultEl.classList.toggle('show', name === 'result');
  drillProgressEl.textContent = name === 'card' ? (drillPos + 1) + ' / ' + drillQueue.length : '';
}

function renderDrillCard(){
  const card = drillQueue[drillPos];
  if(!card) return;
  drillRevealed = false;
  drillCardEl.classList.remove('revealed');
  const meta = OS_META[card.os];
  const osEl = document.getElementById('drillCardOs');
  osEl.innerHTML = '<span class="tag-dot" style="background:' + meta.color + '"></span>' + escapeHtml(meta.label);
  osEl.style.color = badgeTextColor(meta.color);
  document.getElementById('drillCardCat').textContent = drillCatLabel(card);
  const st = drillStats[card.key];
  document.getElementById('drillCardStreak').textContent = st
    ? 'vue ' + ((st.ok || 0) + (st.ko || 0)) + '× · ' + (st.ko || 0) + ' ratée' + ((st.ko || 0) > 1 ? 's' : '')
    : 'nouvelle';
  document.getElementById('drillCardAction').textContent = card.action;
  document.getElementById('drillCardCmd').innerHTML = '<span class="prompt">$</span> ' + escapeHtml(card.cmd);
  document.getElementById('drillCardRisk').innerHTML = riskHtml(card.cmd);
  const noteEl = document.getElementById('drillCardNote');
  noteEl.textContent = card.note || '';
  noteEl.style.display = card.note ? '' : 'none';
  document.getElementById('drillCopy').dataset.cmd = escapeHtml(card.cmd);
  // tant que la réponse est floutée, elle est aussi masquée aux lecteurs d'écran
  document.getElementById('drillAnswer').setAttribute('aria-hidden', 'true');
  showDrillScreen('card');
  document.getElementById('drillReveal').focus();
}

function revealDrillCard(){
  if(drillRevealed) return;
  drillRevealed = true;
  drillCardEl.classList.add('revealed');
  document.getElementById('drillAnswer').removeAttribute('aria-hidden');
  document.getElementById('drillOk').focus();
}

function answerDrillCard(known){
  if(!drillRevealed) return;
  const card = drillQueue[drillPos];
  const st = drillStats[card.key] || { ok: 0, ko: 0 };
  if(known){ st.ok = (st.ok || 0) + 1; drillOkCount++; }
  else { st.ko = (st.ko || 0) + 1; drillMissedList.push(card); }
  st.last = Date.now();
  drillStats[card.key] = st;
  saveDrillStats();
  drillPos++;
  if(drillPos >= drillQueue.length) renderDrillResult();
  else renderDrillCard();
}

function renderDrillResult(){
  const total = drillQueue.length;
  const pct = total ? Math.round((drillOkCount / total) * 100) : 0;
  const verdict = pct === 100 ? 'Sans faute.' : pct >= 70 ? 'Bien joué.' : pct >= 40 ? 'À retravailler.' : 'Le deck a gagné.';
  document.getElementById('drillScore').innerHTML =
    '<span class="drill-score-num">' + drillOkCount + '<span class="drill-score-total">/' + total + '</span></span>' +
    '<span class="drill-score-label">' + verdict + ' ' + pct + '% de réussite.</span>';
  const missedEl = document.getElementById('drillMissed');
  missedEl.innerHTML = drillMissedList.length
    ? '<div class="drill-missed-title">À revoir</div>' + drillMissedList.map(card => (
        '<div class="drill-missed-item">' +
          '<div class="drill-missed-action">' + escapeHtml(card.action) +
            '<span class="drill-missed-os" style="color:' + badgeTextColor(OS_META[card.os].color) + '">' + escapeHtml(OS_META[card.os].label) + '</span>' +
          '</div>' +
          '<div class="cmd-row">' +
            '<code class="cmd-code"><span class="prompt">$</span> ' + escapeHtml(card.cmd) + '</code>' +
            '<button type="button" class="copy-btn" data-cmd="' + escapeHtml(card.cmd) + '" title="Copier" aria-label="Copier">' +
              '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            '</button>' +
          '</div>' +
          riskHtml(card.cmd) +
        '</div>'
      )).join('')
    : '<div class="drill-missed-title">Rien à revoir sur ce tirage.</div>';
  document.getElementById('drillReplayMissed').disabled = !drillMissedList.length;
  showDrillScreen('result');
  document.getElementById('drillAgain').focus();
}

function startDrill(cards){
  const pool = cards || drillCardsFrom(drillSource);
  if(!pool.length) return;
  drillQueue = cards ? pool.slice() : drillPick(pool, Math.min(drillLength, pool.length));
  drillPos = 0;
  drillOkCount = 0;
  drillMissedList = [];
  renderDrillCard();
}

function openDrill(){
  drillLastFocus = document.activeElement;
  renderDrillSetup();
  showDrillScreen('setup');
  drillOverlay.classList.add('open');
  document.body.classList.add('lock-scroll');
  document.getElementById('drillStart').focus();
}
function closeDrill(){
  if(!drillOverlay.classList.contains('open')) return;
  drillOverlay.classList.remove('open');
  document.body.classList.remove('lock-scroll');
  drillLastFocus?.focus();
}

document.getElementById('drillToggle').addEventListener('click', openDrill);
document.getElementById('closeDrill').addEventListener('click', closeDrill);
drillOverlay.addEventListener('click', (e) => { if(e.target === drillOverlay) closeDrill(); });
drillOverlay.addEventListener('keydown', (e) => trapFocus(e, drillOverlay));
drillOverlay.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('.copy-btn');
  if(copyBtn) copyCmd(unescapeCmd(copyBtn.dataset.cmd), copyBtn);
});

document.getElementById('drillSourceChoices').addEventListener('click', (e) => {
  const btn = e.target.closest('.drill-choice');
  if(!btn) return;
  drillSource = btn.dataset.source;
  document.querySelectorAll('#drillSourceChoices .drill-choice').forEach(b => b.classList.toggle('active', b === btn));
  renderDrillSetup();
});
document.getElementById('drillLengthChoices').addEventListener('click', (e) => {
  const btn = e.target.closest('.drill-choice');
  if(!btn) return;
  drillLength = Number(btn.dataset.length);
  document.querySelectorAll('#drillLengthChoices .drill-choice').forEach(b => b.classList.toggle('active', b === btn));
  renderDrillSetup();
});
document.getElementById('drillStart').addEventListener('click', () => startDrill());
document.getElementById('drillReveal').addEventListener('click', revealDrillCard);
document.getElementById('drillOk').addEventListener('click', () => answerDrillCard(true));
document.getElementById('drillKo').addEventListener('click', () => answerDrillCard(false));
document.getElementById('drillAgain').addEventListener('click', () => { renderDrillSetup(); showDrillScreen('setup'); document.getElementById('drillStart').focus(); });
document.getElementById('drillReplayMissed').addEventListener('click', () => {
  if(drillMissedList.length) startDrill(drillMissedList.slice());
});

/* Raccourcis propres à la révision : n'agissent que quand la carte est à l'écran. */
document.addEventListener('keydown', (e) => {
  if(!drillOverlay.classList.contains('open')) return;
  if(!drillCardEl.classList.contains('show')) return;
  if(isTypingTarget(e.target)) return;
  if(e.key === ' ' || e.key === 'Spacebar'){
    e.preventDefault();
    if(!drillRevealed) revealDrillCard();
  } else if(e.key === '1' || e.key === 'ArrowLeft'){
    e.preventDefault();
    answerDrillCard(false);
  } else if(e.key === '2' || e.key === 'ArrowRight'){
    e.preventDefault();
    answerDrillCard(true);
  }
});

/* ==========================================================
   Changelog — un vrai historique des changements livrés, pas des
   dates de "vérification" par système (impossible à garantir
   honnêtement sur 5000+ commandes). Nouvelle entrée à ajouter en
   tête à chaque évolution notable du site.
   ========================================================== */
const CHANGELOG = [
  {
    date: '2026-08-24',
    items: [
      '8 nouveaux outils : Bash (scripting), grep · sed · awk, curl, jq, rsync, Nmap, nftables & iptables, OpenSSL — 377 commandes de plus.',
      '245 notes ajoutées : ce que fait vraiment un drapeau, le piège classique, la commande qui l\'a remplacée. 63% des cartes en ont une, contre 5% avant.',
      'Chaque commande a son lien direct : l’icône de chaîne copie une URL qui rouvre le deck sur cette carte précise.',
      'Les sections commencent enfin par les bases : « Commandes de base » passe devant « Astuces » dans tous les decks d\'outils.',
      'Mode révision : le deck pose l\'action, à toi de retrouver la commande — les cartes ratées reviennent plus souvent, le score reste sur ta machine.',
      'Les termes cherchés sont surlignés dans les résultats, dans le deck comme dans la recherche globale.',
      'Recherche globale classée par pertinence (et non plus par ordre du fichier) : le système ouvert et les correspondances exactes remontent en tête.',
      'Ctrl+Entrée copie le résultat sélectionné sans quitter la recherche.',
      'Les flèches ← → ne changent plus de système quand une fenêtre est ouverte par-dessus.',
      'Les commandes qui ne se rattrapent pas (rm -rf, terraform destroy, docker prune, git push --force…) portent maintenant un avertissement, sur la carte comme en révision.',
      'Les noms de systèmes dont la couleur de marque est trop sombre (AlmaLinux, Devuan, Slackware…) sont enfin lisibles sur le thème sombre.',
      'Les favoris ne se décalent plus quand une commande est ajoutée au milieu d’une catégorie.',
    ],
  },
  {
    date: '2026-08-08',
    items: [
      'Recherche globale (Ctrl+K) : cherche dans les 51 systèmes à la fois, plus seulement celui affiché.',
      'Liens profonds : chaque système/catégorie a sa propre URL, partageable et compatible précédent/suivant du navigateur.',
      'Navigation clavier : flèches ← → pour changer de système, modal "?" listant tous les raccourcis.',
      '4 nouveaux outils : kubectl, Terraform, Ansible, Python (venv/pip) — 155 commandes.',
      'Export/import des favoris en JSON — pour les transporter d\'un appareil à l\'autre sans compte.',
      'Thème clair/sombre : respecte la préférence système au premier chargement.',
      'Chargement des icônes différé (perf) et Content-Security-Policy ajoutée.',
    ],
  },
];
const changelogOverlay = document.getElementById('changelogOverlay');
let changelogLastFocus = null;
function renderChangelog(){
  document.getElementById('changelogList').innerHTML = CHANGELOG.map(entry => `
    <div class="changelog-entry">
      <div class="changelog-entry-date">${entry.date}</div>
      <ul class="changelog-entry-items">${entry.items.map(i => `<li>${i}</li>`).join('')}</ul>
    </div>
  `).join('');
}
function openChangelog(){
  changelogLastFocus = document.activeElement;
  renderChangelog();
  changelogOverlay.classList.add('open');
  document.body.classList.add('lock-scroll');
  document.getElementById('closeChangelog').focus();
}
function closeChangelog(){
  if(!changelogOverlay.classList.contains('open')) return;
  changelogOverlay.classList.remove('open');
  document.body.classList.remove('lock-scroll');
  changelogLastFocus?.focus();
}
document.getElementById('changelogLink').addEventListener('click', (e) => { e.preventDefault(); openChangelog(); });
document.getElementById('closeChangelog').addEventListener('click', closeChangelog);
changelogOverlay.addEventListener('click', (e) => { if(e.target === changelogOverlay) closeChangelog(); });
changelogOverlay.addEventListener('keydown', (e) => trapFocus(e, changelogOverlay));

function isTypingTarget(el){
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

document.addEventListener('keydown', (e) => {
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    openPalette();
  }
  if(e.key === '?' && !isTypingTarget(e.target)){
    e.preventDefault();
    openShortcuts();
  }
  if((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !isTypingTarget(e.target) && !anyOverlayOpen()){
    e.preventDefault();
    navigateOS(e.key === 'ArrowLeft' ? -1 : 1);
  }
  if((e.key === 'r' || e.key === 'R') && !isTypingTarget(e.target) && !anyOverlayOpen() && !e.ctrlKey && !e.metaKey && !e.altKey){
    e.preventDefault();
    openDrill();
  }
  if(e.key === 'Escape'){ closeSaved(); closeCompare(); closePalette(); closeShortcuts(); closeChangelog(); closeDrill(); }
});

document.getElementById('launchBtn').addEventListener('click', () => {
  document.querySelector('.deck-anchor').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('exploreBtn').addEventListener('click', () => {
  document.querySelector('.deck-anchor').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ==========================================================
   Lenis smooth scroll
   ========================================================== */
let lenis;
function initLenis(){
  if(window.Lenis){
    lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, easing: (t) => 1 - Math.pow(1 - t, 3) });
    function raf(time){ lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }
}

/* ==========================================================
   Hero: cinematic line-by-line reveal + scroll parallax
   ========================================================== */
function playHero(){
  const lines = document.querySelectorAll('.term-line');
  lines.forEach((line, i) => {
    setTimeout(() => line.classList.add('reveal'), 180 + 220 * i);
  });
}

function initParallax(){
  const streaks = document.getElementById('heroStreaks');
  const hero = document.getElementById('hero');
  const coverBodies = document.querySelectorAll('.cover-body');
  let scheduled = false;
  function update(){
    scheduled = false;
    const y = window.scrollY || window.pageYOffset;
    const heroH = hero.offsetHeight;
    const progress = Math.min(y / heroH, 1);
    if(streaks) streaks.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
    hero.style.opacity = String(1 - progress * 0.7);
    coverBodies.forEach(el => {
      el.style.transform = `translate3d(0, ${y * 0.08}px, 0)`;
    });
  }
  function onScroll(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  update();
}

/* ==========================================================
   Init
   ========================================================== */
/* ==========================================================
   PWA: service worker registration (offline + installable)
   ========================================================== */
function initServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ==========================================================
   Lazy-load des logos officiels (OS_ICONS, ~27 Ko gzippés) après le
   premier rendu : les onglets/badges affichent le badge textuel
   (OS_META[os].glyph) en attendant, ce qui garde le chargement
   initial léger sans jamais bloquer l'affichage sur les icônes.
   ========================================================== */
let iconsLoaded = false;
function loadIcons(){
  if(iconsLoaded || typeof OS_ICONS !== 'undefined') return;
  const s = document.createElement('script');
  s.src = 'icons.js?v=20260824f';
  s.onload = () => {
    iconsLoaded = true;
    renderDistroTabs();
    renderOsHead();
    if(activeTag) activateTag(activeTag);
  };
  document.head.appendChild(s);
}

function initFooterLinks(){
  document.getElementById('manifestoScroll').addEventListener('click', () => {
    document.getElementById('hero').scrollIntoView({ behavior: 'smooth' });
  });
  document.querySelectorAll('[data-os-link]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.cheatdeckSwitchTo(a.dataset.osLink, true);
    });
  });
}

function init(){
  const cameFromDeepLink = resolveInitialState();
  initTheme();
  initServiceWorker();
  renderCommandCounts();
  renderFamilyTabs();
  renderGroupTabs();
  renderDistroTabs();
  renderOsHead();
  renderCatFilters();
  renderContent();
  renderTagBar();
  updateSavedCount();
  renderSavedList();
  initFooterLinks();
  initLenis();
  playHero();
  initParallax();
  setHash(true);
  if(cameFromDeepLink) document.querySelector('.deck-anchor').scrollIntoView({ behavior: 'auto', block: 'start' });
  if(pendingCommandHash) setTimeout(() => flashCommand(pendingCommandHash), 200);
  if('requestIdleCallback' in window) requestIdleCallback(loadIcons, { timeout: 2000 });
  else setTimeout(loadIcons, 300);
}
init();
