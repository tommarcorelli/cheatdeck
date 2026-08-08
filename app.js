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
function favKey(os, cat, idx){ return `${os}::${cat}::${idx}`; }
function isFav(key){ return favorites.some(f => f.key === key); }

/* ==========================================================
   Theme (dark default, light optional — persisted)
   ========================================================== */
const THEME_KEY = 'cheatdeck_theme';
function isLightTheme(){ return document.documentElement.getAttribute('data-theme') === 'light'; }
function badgeTextColor(hex){ return isLightTheme() ? 'var(--fg)' : hex; }
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
  catFiltersEl.innerHTML = `<button type="button" class="cat-pill active" data-cat="all">Tout</button>` +
    active.map(c => `<button type="button" class="cat-pill" data-cat="${c.id}"><span class="cat-pill-icon">${iconFor(c.id)}</span>${labelFor(currentOS, c.id, c.label)}</button>`).join('');
}

/* ==========================================================
   Render: content grid
   ========================================================== */
const contentEl = document.getElementById('content');
function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderContent(){
  const osData = DATA[currentOS];
  contentEl.innerHTML = CATEGORIES.map(cat => {
    const items = osData[cat.id];
    if(!items || !items.length) return '';
    const label = labelFor(currentOS, cat.id, cat.label);
    const cards = items.map(([action, cmd, note], idx) => {
      const key = favKey(currentOS, cat.id, idx);
      const starred = isFav(key);
      const searchBlob = normalize(action + ' ' + cmd);
      return `
        <div class="cmd-card" data-search="${searchBlob.replace(/"/g,'&quot;')}" data-cat="${cat.id}">
          <div class="cmd-top">
            <span class="cmd-action">${action}</span>
            <button type="button" class="star-btn ${starred ? 'starred' : ''}" data-key="${key}" data-os="${currentOS}" data-cat="${cat.id}" data-idx="${idx}" title="Épingler" aria-label="Épingler">
              <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z"/></svg>
            </button>
          </div>
          <div class="cmd-tag"><span class="tag-dot" style="background:${OS_META[currentOS].color}"></span>${OS_META[currentOS].label.toUpperCase()}</div>
          <div class="cmd-row">
            <code class="cmd-code"><span class="prompt">$</span> ${escapeHtml(cmd)}</code>
            <button type="button" class="copy-btn" data-cmd="${escapeHtml(cmd)}" title="Copier" aria-label="Copier">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
          ${note ? `<div class="cmd-note">${note}</div>` : ''}
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

function applyFilters(){
  const term = normalize(searchInput.value.trim());
  const cards = document.querySelectorAll('.cmd-card');
  let visible = 0;

  cards.forEach(card => {
    const matchesSearch = !term || fuzzyMatch(term, card.dataset.search);
    const matchesCat = currentCat === 'all' || card.dataset.cat === currentCat;
    const show = matchesSearch && matchesCat;
    card.classList.toggle('hidden', !show);
    if(show) visible++;
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
});

/* ==========================================================
   Family + group + distro switching
   ========================================================== */
function switchTo(os, scroll){
  currentOS = os;
  currentFamily = familyOf(os).id;
  const g = groupOf(os);
  currentGroup = g ? g.id : null;
  currentCat = 'all';
  searchInput.value = '';
  if(activeTag){ activeTag = null; tagResultsEl.classList.remove('show'); toggleNormalNav(true); renderTagBar(); }
  renderFamilyTabs();
  renderGroupTabs();
  renderDistroTabs();
  renderOsHead();
  renderCatFilters();
  renderContent();
  if(scroll) document.querySelector('.deck-anchor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.cheatdeckSwitchTo = switchTo;

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

async function copyCmd(cmd, btn){
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
  showToast('Commande copiée');
}

contentEl.addEventListener('click', (e) => {
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
let paletteMatches = [];
let paletteSelected = 0;
let paletteLastFocus = null;

function paletteRowHtml(item, i){
  return `
    <button type="button" class="palette-row ${i === paletteSelected ? 'active' : ''}" data-index="${i}">
      <span class="palette-row-os" style="color:${OS_META[item.os].color}"><span class="tag-dot" style="background:${OS_META[item.os].color}"></span>${OS_META[item.os].label}</span>
      <span class="palette-row-action">${escapeHtml(item.action)}</span>
      <code class="palette-row-cmd">${escapeHtml(item.cmd)}</code>
    </button>
  `;
}

function runPaletteSearch(){
  const term = normalize(paletteInput.value.trim());
  if(!term){
    paletteMatches = [];
    paletteResultsEl.innerHTML = '';
    paletteResultsEl.classList.remove('show');
    paletteEmptyEl.classList.remove('show');
    return;
  }
  paletteMatches = buildGlobalIndex().filter(item => fuzzyMatch(term, item.blob)).slice(0, PALETTE_LIMIT);
  paletteSelected = 0;
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
  const key = favKey(item.os, item.cat, item.idx);
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
    if(paletteMatches[paletteSelected]) jumpToPaletteItem(paletteMatches[paletteSelected]);
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
  if(e.key === 'Escape'){ closeSaved(); closeCompare(); closePalette(); closeShortcuts(); }
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
}
init();
