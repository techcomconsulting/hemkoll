// Små hjälpfunktioner för utseende, text och siffror.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const round1 = (n) => Math.round(n * 10) / 10;

export function fmt1(n) {
  if (n == null || isNaN(n)) return '–';
  return round1(Number(n)).toFixed(1).replace('.', ',');
}

export function signed(n, unit = '') {
  if (n == null || isNaN(n)) return '–';
  const r = round1(n);
  const s = r > 0 ? '+' : r < 0 ? '−' : '±';
  return s + fmt1(Math.abs(r)) + (unit ? ' ' + unit : '');
}

export function parseNum(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, ''));
  return isNaN(n) ? null : n;
}

const MON = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONL = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const DAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

export function toDate(x) {
  if (!x) return null;
  if (typeof x.toDate === 'function') return x.toDate();
  if (x instanceof Date) return x;
  return new Date(x);
}
export const pad = (n) => String(n).padStart(2, '0');
export const dShort = (x) => { const d = toDate(x); return d ? d.getDate() + ' ' + MON[d.getMonth()] : ''; };
export const dLong = (x) => { const d = toDate(x); return d ? d.getDate() + ' ' + MONL[d.getMonth()] : ''; };
export const dFull = (x) => { const d = toDate(x); return d ? d.getDate() + ' ' + MONL[d.getMonth()] + ' ' + d.getFullYear() : ''; };
export const dDay = (x) => { const d = toDate(x); return d ? DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONL[d.getMonth()] : ''; };
export const tHM = (x) => { const d = toDate(x); return d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''; };
export const isoDay = (x) => { const d = toDate(x) || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

export function ago(x) {
  const d = toDate(x);
  if (!d) return '';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'Nyss';
  if (min < 60) return `För ${min} min sedan`;
  const h = Math.round(min / 60);
  if (h < 24) return `För ${h} ${h === 1 ? 'timme' : 'timmar'} sedan`;
  if (h < 48) return 'Igår';
  return dShort(d);
}

const AV = [['#FCEEF4', '#8A2E55'], ['#F2EDF9', '#4A3F6B'], ['#E2EAF1', '#2F4A63'], ['#FBF1EA', '#7A3E20'], ['#E6EFEA', '#2E5A48']];
export function avatar(name, img, size = 40) {
  const s = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;`;
  if (img) return `<span class="avatar" style="${s}background-image:url('${esc(img)}')" role="img" aria-label="${esc(name)}"></span>`;
  const n = String(name || '?');
  let h = 0;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 997;
  const [bg, fg] = AV[h % AV.length];
  return `<span class="avatar" style="${s}background:${bg};color:${fg}" aria-hidden="true">${esc(n.trim().charAt(0).toUpperCase() || '?')}</span>`;
}

const P = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  chart: '<path d="M4 19h16M7 16v-5M12 16V7M17 16v-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.3.1 4 1.5 4.5 4.4"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
  pill: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  face: '<circle cx="12" cy="9" r="4"/><path d="M4.5 21c.9-4 3.9-6 7.5-6s6.6 2 7.5 6"/>',
  body: '<circle cx="12" cy="4" r="2"/><path d="M8 8h8l-1 7h-1.5l-.5 7h-2l-.5-7H9z"/>',
  comment: '<path d="M4 5h16v11H9l-5 4z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4z"/><path d="M4 7V6a2 2 0 0 1 2-2h10v3"/><circle cx="16" cy="13.5" r="1.2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z"/>',
  book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  home2: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>'
};
export function icon(name, size = 22, sw = 1.8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export function backLink(href, label) {
  return `<a class="back" href="${href}">${icon('back', 20, 2.2)}${esc(label)}</a>`;
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// Ett fönster som glider upp nerifrån.
export function openSheet(html, label = 'Dialog') {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><span class="handle"></span>${html}</div>`;
  document.body.appendChild(wrap);
  const sheet = wrap.querySelector('.sheet');
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  const first = sheet.querySelector('input, textarea, button');
  if (first) setTimeout(() => first.focus(), 50);
  return { el: sheet, close };
}

export function confirmSheet({ title, text = '', ok = 'OK', cancel = 'Avbryt', danger = false }) {
  return new Promise((resolve) => {
    const s = openSheet(`
      <h2>${esc(title)}</h2>
      ${text ? `<p class="muted">${esc(text)}</p>` : ''}
      <div class="btn-row">
        <button class="btn" data-no>${esc(cancel)}</button>
        <button class="btn ${danger ? 'danger-outline' : 'primary'}" data-yes>${esc(ok)}</button>
      </div>`, title);
    s.el.querySelector('[data-no]').onclick = () => { s.close(); resolve(false); };
    s.el.querySelector('[data-yes]').onclick = () => { s.close(); resolve(true); };
  });
}

export async function busy(btn, fn) {
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Vänta…';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
}

// Enkel linjegraf som SVG.
export function lineChart(vals, { w = 320, h = 150, color = '#7B5EA7', fill = '#F3EEFA', label = 'Graf' } = {}) {
  const v = vals.filter((x) => x != null && !isNaN(x));
  if (v.length < 2) return `<div class="empty">Minst två mätningar behövs för en graf.</div>`;
  const mn = Math.min(...v), mx = Math.max(...v);
  const padV = (mx - mn) * 0.12 || 1;
  const lo = mn - padV, hi = mx + padV;
  const pts = v.map((y, i) => [i * (w - 12) / (v.length - 1) + 6, 8 + (hi - y) / (hi - lo) * (h - 16)]);
  const s = (p) => p[0].toFixed(1) + ',' + p[1].toFixed(1);
  const last = pts[pts.length - 1];
  const area = `M${pts[0][0].toFixed(1)},${h} L${pts.map(s).join(' L')} L${last[0].toFixed(1)},${h} Z`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
    <line x1="0" y1="8" x2="${w}" y2="8" stroke="#EEEAE3"/>
    <line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#EEEAE3"/>
    <line x1="0" y1="${h - 8}" x2="${w}" y2="${h - 8}" stroke="#EEEAE3"/>
    <path d="${area}" fill="${fill}"/>
    <polyline points="${pts.map(s).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5.5" fill="#fff" stroke="${color}" stroke-width="2.5"/>
  </svg>`;
}

export function bmi(weight, heightCm) {
  if (!weight || !heightCm) return null;
  const m = heightCm / 100;
  return round1(weight / (m * m));
}

export function bmiScale(value) {
  const left = Math.max(0, Math.min(100, ((value - 15) / 25) * 100));
  return `<div class="bmi-scale" aria-hidden="true">
      <span style="width:14%;background:#E3E0DA"></span>
      <span style="width:26%;background:#DCD2EC"></span>
      <span style="width:20%;background:#F0D9E3"></span>
      <span style="width:40%;background:#E9CBD8"></span>
      <span class="marker" style="left:${left}%"></span>
    </div>
    <div class="bmi-labels"><span>18,5</span><span>25</span><span>30</span><span>40</span></div>`;
}

// Gör en bild mindre så att den får plats i databasen.
export function resizeImage(file, max = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let q = quality;
      let data = c.toDataURL('image/jpeg', q);
      while (data.length > 850000 && q > 0.35) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kunde inte läsa bilden')); };
    img.src = url;
  });
}

export function kr(n) {
  if (n == null || isNaN(n)) return '–';
  return Math.round(n).toLocaleString('sv-SE') + '\u00a0kr';
}

export function errorText(e) {
  const code = e?.code || e?.message || '';
  const map = {
    'auth/invalid-credential': 'Fel e-post eller lösenord.',
    'auth/wrong-password': 'Fel lösenord.',
    'auth/user-not-found': 'Det finns inget konto med den e-posten.',
    'auth/email-already-in-use': 'E-posten används redan.',
    'auth/weak-password': 'Lösenordet måste ha minst 6 tecken.',
    'auth/invalid-email': 'E-postadressen ser fel ut.',
    'auth/too-many-requests': 'För många försök. Vänta en stund.',
    'auth/requires-recent-login': 'Logga in igen och försök sedan.',
    'auth/network-request-failed': 'Ingen internetanslutning.',
    'permission-denied': 'Du har inte behörighet till detta.',
    'db-timeout': 'Databasen svarar inte. Kontrollera att Firestore är skapad.',
    'unavailable': 'Ingen internetanslutning.'
  };
  return map[code] || 'Något gick fel. Försök igen.';
}
