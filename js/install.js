// Hjälp att lägga appen på hemskärmen.
import { openSheet, icon, esc } from './ui.js';

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });

export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const shareIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-4px"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>';

export async function showInstall() {
  if (deferred) {
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    return;
  }
  const steps = isIOS()
    ? [
      `Tryck på dela-knappen ${shareIcon} längst ner i Safari.`,
      'Scrolla ner och tryck <b>Lägg till på hemskärmen</b>.',
      'Tryck <b>Lägg till</b> uppe till höger.'
    ]
    : [
      'Tryck på menyn <b>⋮</b> uppe till höger i Chrome.',
      'Tryck <b>Installera app</b> eller <b>Lägg till på startskärmen</b>.',
      'Tryck <b>Installera</b>.'
    ];
  openSheet(`
    <span style="width:56px;height:56px;border-radius:16px;overflow:hidden;display:block"><img src="icons/icon-192.png" alt="" width="56" height="56"></span>
    <h2>Lägg Hemkoll på hemskärmen</h2>
    ${isIOS() ? '<p class="muted" style="font-size:14px">Det måste göras i <b>Safari</b>. iPhone tillåter inte att en knapp gör det åt dig.</p>' : ''}
    <ol style="margin:0;padding-left:22px;display:flex;flex-direction:column;gap:12px;font-size:16px;line-height:1.4">
      ${steps.map((s) => `<li>${s}</li>`).join('')}
    </ol>
    <button class="btn primary block" data-close>Okej</button>`, 'Hemskärmen');
}

// Liten ruta på översikten. Visas tills man stänger den.
export function installBanner() {
  if (isInstalled()) return '';
  try { if (localStorage.getItem('vt-install-hide')) return ''; } catch { /* ok */ }
  return `<div class="card row" data-install style="padding:12px 14px">
    <img src="icons/icon-192.png" alt="" width="36" height="36" style="border-radius:10px">
    <button class="grow" data-install-open style="border:0;background:none;text-align:left;padding:0;cursor:pointer;font-size:15px;min-height:44px"><b>Lägg appen på hemskärmen</b><br><span class="small muted">Då öppnas den som en vanlig app.</span></button>
    <button class="icon-btn" style="box-shadow:none;background:transparent" data-install-hide aria-label="Stäng">${icon('close', 18, 2)}</button>
  </div>`;
}

export function wireInstallBanner(root) {
  const box = root.querySelector('[data-install]');
  if (!box) return;
  box.querySelector('[data-install-open]').addEventListener('click', showInstall);
  box.querySelector('[data-install-hide]').addEventListener('click', () => {
    try { localStorage.setItem('vt-install-hide', '1'); } catch { /* ok */ }
    box.remove();
  });
}

export { esc };
