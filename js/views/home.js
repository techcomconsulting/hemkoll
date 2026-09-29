// Översikt: det viktigaste just nu.
import { loadDocs, loadReminders, loadItems, loadPaid, ymKey, occursIn, acceptInvite, declineInvite } from '../data.js';
import { esc, icon, kr, dDay, toast, errorText } from '../ui.js';
import { MONTHS, dayInMonth, daysUntil, whenText } from '../dates.js';
import { monthSummary } from './budget.js';
import { reminderRow, wireReminderRows } from './reminders.js';
import { installBanner, wireInstallBanner } from '../install.js';
import { finishAccountView } from './auth.js';

export async function homeView(el, ctx) {
  const { state } = ctx;
  if (!state.profile || !state.spaces.length) { finishAccountView(el, ctx); return; }
  const space = ctx.space();
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const [docs, reminders, items, paid, paidNext] = await Promise.all([
    loadDocs(space.id), loadReminders(space.id), loadItems(space.id),
    loadPaid(space.id, ymKey(y, m)), loadPaid(space.id, ymKey(ny, nm))
  ]);
  const S = monthSummary(items, paid, y, m);

  // Räkningar som ska betalas inom 30 dagar.
  const bills = [];
  for (const [yy, mm, pd] of [[y, m, paid], [ny, nm, paidNext]]) {
    items.filter((i) => i.kind !== 'income' && occursIn(i, yy, mm) && !pd[i.id]).forEach((i) => {
      const due = dayInMonth(yy, mm, i.day);
      const n = daysUntil(due);
      if (n <= 30 && (yy === y && mm === m ? true : n >= 0)) bills.push({ ...i, due, n });
    });
  }
  bills.sort((a, b) => a.n - b.n);
  const soonRem = reminders.filter((r) => daysUntil(r.next) <= 30);
  const warr = docs.filter((d) => d.warrantyUntil && daysUntil(d.warrantyUntil) >= 0 && daysUntil(d.warrantyUntil) <= 60)
    .sort((a, b) => a.warrantyUntil.localeCompare(b.warrantyUntil));

  el.innerHTML = `<div class="screen">
    <header class="stack" style="gap:2px">
      <span class="muted" style="font-size:14px;font-weight:500">${esc(dDay(now))}</span>
      <h1>Hej ${esc(state.profile.firstName)}</h1>
    </header>
    ${ctx.spaceBar()}
    ${state.invites.map((s) => `<section class="card stack-lg">
      <b>${esc(s.memberNames?.[s.owner] || 'Någon')} bjuder in dig till fliken ${esc(s.name)}</b>
      <div class="btn-row"><button class="btn sm" data-decline="${s.id}">Nej tack</button><button class="btn primary sm" data-accept="${s.id}">Gå med</button></div>
    </section>`).join('')}

    <a class="card stack-lg" href="#/budget" style="text-decoration:none;color:inherit">
      <div class="between"><span class="muted" style="font-size:14px;font-weight:600">Kvar i ${MONTHS[m - 1]}</span>${icon('right', 18, 2)}</div>
      <span class="big num" style="font-size:42px;color:${S.left < 0 ? 'var(--pink-ink)' : 'var(--ink)'}">${items.length ? kr(S.left) : '–'}</span>
      ${S.exp.length ? `<div class="stack" style="gap:6px"><div class="progress"><span style="width:${(S.paidCount / S.exp.length) * 100}%"></span></div>
        <span class="small muted">${S.paidCount} av ${S.exp.length} räkningar betalda</span></div>`
        : '<span class="small muted">Lägg in inkomster och räkningar under Budget.</span>'}
    </a>

    <section class="stack"><h2>Snart</h2>
      ${bills.length || soonRem.length || warr.length ? `<div class="card flush">
        ${bills.slice(0, 6).map((b) => `<a class="list-row" href="#/budget">
          <span style="color:var(--accent)">${icon('wallet')}</span>
          <span class="grow stack" style="gap:2px"><span class="title">${esc(b.name)}</span><span class="sub" style="${b.n < 0 ? 'color:var(--pink-ink);font-weight:600' : ''}">${b.n < 0 ? 'Sista dag passerad' : 'Betala ' + esc(whenText(b.due).toLowerCase())}</span></span>
          <span class="num" style="font-weight:700">${kr(b.amount)}</span></a>`).join('')}
        <div data-rems>${soonRem.map(reminderRow).join('')}</div>
        ${warr.map((d) => `<a class="list-row" href="#/parm/${d.id}">
          <span style="color:var(--pink)">${icon('shield')}</span>
          <span class="grow stack" style="gap:2px"><span class="title">${esc(d.title)}</span><span class="sub">Garantin går ut ${esc(whenText(d.warrantyUntil).toLowerCase())}</span></span>${icon('right', 18, 2)}</a>`).join('')}
      </div>` : '<div class="card empty">Inget som behöver göras de närmaste 30 dagarna. 🎉</div>'}
      <a class="btn ghost" href="#/paminnelser">${icon('bell', 18)}Alla påminnelser</a>
    </section>

    <section class="grid2">
      <a class="stat" href="#/parm"><span class="label">I pärmen</span><span class="value">${docs.length}</span><span class="small muted">dokument</span></a>
      <a class="stat" href="#/paminnelser"><span class="label">Påminnelser</span><span class="value">${reminders.length}</span><span class="small muted">totalt</span></a>
    </section>
    ${installBanner()}
  </div>`;

  wireReminderRows(el.querySelector('[data-rems]') || el, ctx, soonRem, () => ctx.rerender());
  wireInstallBanner(el);
  ctx.wireSpaceBar(el);
  el.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', async () => {
    try { await acceptInvite(b.dataset.accept, state.user.uid, state.profile.firstName); await ctx.reloadSpaces(); toast('Du är med!'); ctx.setSpace(b.dataset.accept); } catch (ex) { toast(errorText(ex)); }
  }));
  el.querySelectorAll('[data-decline]').forEach((b) => b.addEventListener('click', async () => {
    try { await declineInvite(b.dataset.decline, state.user.uid); await ctx.reloadSpaces(); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
  }));
}
