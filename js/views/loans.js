// Lån och krediter. Annonser via affiliate-länkar (se config.js).
// Varningen följer Konsumentverkets regler (KOVFS 2025:1) och ska synas innan man klickar.
import { loanOffers } from '../config.js';
import { esc, icon, backLink, openSheet } from '../ui.js';

export const hasLoans = () => loanOffers.some((o) => /^https:\/\//i.test(o.url || ''));

const triangle = `<svg width="44" height="40" viewBox="0 0 44 40" aria-hidden="true" style="flex-shrink:0">
  <path d="M22 3L41 37H3z" fill="#fff" stroke="#D52B1E" stroke-width="4" stroke-linejoin="round"/>
  <rect x="20" y="13" width="4" height="13" rx="1" fill="#000"/><rect x="20" y="29" width="4" height="4" rx="1" fill="#000"/></svg>`;

export const loanWarning = `<div class="loan-warn" role="note">
  ${triangle}
  <div class="stack" style="gap:4px"><b style="font-size:17px">Att låna kostar pengar!</b>
  <span>Om du inte kan betala tillbaka skulden i tid riskerar du en betalningsanmärkning. Det kan leda till svårigheter att få hyra bostad, teckna abonnemang och få nya lån. För stöd, vänd dig till budget- och skuldrådgivningen i din kommun. Kontaktuppgifter finns på konsumentverket.se</span></div>
</div>`;

export async function loansView(el) {
  const offers = loanOffers.filter((o) => /^https:\/\//i.test(o.url || ''));
  el.innerHTML = `<div class="screen">
    ${backLink('#/mer', 'Mer')}
    <h1>Lån och krediter</h1>
    ${loanWarning}
    ${offers.length ? offers.map((o, i) => `<section class="card stack-lg">
        <div class="between"><b style="font-size:18px">${esc(o.namn)}</b><span class="chip neutral" style="font-size:12px">Annons</span></div>
        ${o.text ? `<p>${esc(o.text)}</p>` : ''}
        ${o.exempel ? `<p class="small muted">${esc(o.exempel)}</p>` : ''}
        <button class="btn outline block" data-go="${i}">Gå till ${esc(o.namn)}${icon('right', 18, 2)}</button>
      </section>`).join('')
      : '<div class="card empty">Inga erbjudanden just nu.</div>'}
    <p class="small muted">Hemkoll kan få ersättning om du ansöker via länkarna. Det påverkar inte vad lånet kostar dig.</p>
  </div>`;

  el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    const o = offers[Number(b.dataset.go)];
    const s = openSheet(`<h2>Du lämnar Hemkoll</h2>
      ${loanWarning}
      <p class="muted">Du skickas till ${esc(o.namn)}. Tänk igenom om du behöver lånet och om du klarar betalningarna.</p>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button>
      <a class="btn primary" href="${esc(o.url)}" target="_blank" rel="noopener sponsored" data-close>Fortsätt</a></div>`, 'Lämnar Hemkoll');
  }));
}
