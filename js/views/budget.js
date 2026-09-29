// Budget: inkomster, utgifter, räkningar och vad som blir kvar.
import {
  EXPENSE_CATS, INCOME_CATS, FREQS, occursIn, loadItems, saveItem, deleteItem, loadPaid, setPaid, ymKey
} from '../data.js';
import { esc, icon, kr, parseNum, openSheet, confirmSheet, toast, busy, errorText } from '../ui.js';
import { MONTHS, dayInMonth, fmtShort, daysUntil } from '../dates.js';
import { spaceSelect } from './binder.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function monthSummary(items, paid, y, m) {
  const list = items.filter((i) => occursIn(i, y, m));
  const inc = list.filter((i) => i.kind === 'income');
  const exp = list.filter((i) => i.kind !== 'income').sort((a, b) => (a.day || 1) - (b.day || 1));
  const sum = (a) => a.reduce((t, i) => t + (Number(i.amount) || 0), 0);
  const paidCount = exp.filter((i) => paid[i.id]).length;
  return { inc, exp, income: sum(inc), expense: sum(exp), left: sum(inc) - sum(exp), paidCount, unpaidSum: sum(exp.filter((i) => !paid[i.id])) };
}

export function openItemEditor(ctx, kind, existing = null, onSaved = null) {
  const now = new Date();
  const it = existing || { kind, freq: 'monthly', day: 25, month: now.getMonth() + 1, year: now.getFullYear(), category: kind === 'income' ? 'Lön' : 'Boende' };
  const cats = it.kind === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const isInc = it.kind === 'income';
  const s = openSheet(`
    <h2>${existing ? 'Ändra' : isInc ? 'Ny inkomst' : 'Ny utgift'}</h2>
    <div class="field"><label for="in">${isInc ? 'Vad för inkomst?' : 'Vad ska betalas?'}</label><input class="input" id="in" maxlength="60" value="${esc(it.name || '')}" placeholder="${isInc ? 't.ex. Lön' : 't.ex. Hyra, el, Netflix'}"></div>
    <div class="grid2">
      <div class="field"><label for="ia">Belopp (kr)</label><input class="input" id="ia" inputmode="decimal" value="${it.amount ?? ''}"></div>
      <div class="field"><label for="ic">Kategori</label><select class="input" id="ic">${cats.map((c) => `<option ${c === it.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="if">Hur ofta?</label><select class="input" id="if">${FREQS.map(([k, l]) => `<option value="${k}" ${k === it.freq ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="grid2">
      <div class="field"><label for="id">${isInc ? 'Dag den kommer' : 'Sista betalningsdag'}</label><input class="input" id="id" inputmode="numeric" value="${it.day || 25}"></div>
      <div class="field" data-month><label for="im">Månad</label><select class="input" id="im">${MONTHS.map((mn, i) => `<option value="${i + 1}" ${i + 1 === it.month ? 'selected' : ''}>${cap(mn)}</option>`).join('')}</select></div>
    </div>
    ${existing ? '' : spaceSelect(ctx, ctx.state.spaceId)}
    <p class="error hidden" role="alert">Fyll i namn och belopp.</p>
    <div class="btn-row">${existing ? '<button class="btn danger-outline" data-del>Ta bort</button>' : '<button class="btn" data-close>Avbryt</button>'}<button class="btn primary" data-save>Spara</button></div>`, 'Budget');
  const freqSel = s.el.querySelector('#if');
  const monthBox = s.el.querySelector('[data-month]');
  const syncMonth = () => { monthBox.style.visibility = freqSel.value === 'monthly' ? 'hidden' : 'visible'; };
  freqSel.addEventListener('change', syncMonth);
  syncMonth();
  s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
    const name = s.el.querySelector('#in').value.trim();
    const amount = parseNum(s.el.querySelector('#ia').value);
    if (!name || amount == null || amount < 0) { s.el.querySelector('.error').classList.remove('hidden'); return; }
    const day = Math.min(31, Math.max(1, Math.round(parseNum(s.el.querySelector('#id').value) || 1)));
    const month = Number(s.el.querySelector('#im').value);
    const freq = freqSel.value;
    let year = it.year || now.getFullYear();
    if (freq === 'once' && !existing) year = month < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
    const data = { kind: it.kind, name, amount, category: s.el.querySelector('#ic').value, freq, day, month, year };
    const sid = s.el.querySelector('#sp')?.value || ctx.state.spaceId;
    await busy(e.currentTarget, async () => {
      try {
        await saveItem(existing ? ctx.state.spaceId : sid, data, existing?.id);
        s.close();
        toast('Sparat.');
        if (!existing && sid !== ctx.state.spaceId) ctx.setSpace(sid);
        else if (onSaved) onSaved(); else ctx.rerender();
      } catch (ex) { toast(errorText(ex)); }
    });
  });
  const del = s.el.querySelector('[data-del]');
  if (del) del.addEventListener('click', async () => {
    s.close();
    if (!(await confirmSheet({ title: `Ta bort ${existing.name}?`, ok: 'Ta bort', danger: true }))) return;
    try { await deleteItem(ctx.state.spaceId, existing.id); if (onSaved) onSaved(); else ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
  });
}

export async function budgetView(el, ctx) {
  const space = ctx.space();
  if (!space) { ctx.go('/'); return; }
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth() + 1;
  let items = await loadItems(space.id);

  const draw = async () => {
    const ym = ymKey(y, m);
    const paid = await loadPaid(space.id, ym);
    const S = monthSummary(items, paid, y, m);
    const isNow = y === now.getFullYear() && m === now.getMonth() + 1;
    const byCat = {};
    S.exp.forEach((i) => { byCat[i.category] = (byCat[i.category] || 0) + Number(i.amount || 0); });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = cats[0]?.[1] || 1;

    const billRow = (i) => {
      const due = dayInMonth(y, m, i.day);
      const late = !paid[i.id] && isNow && daysUntil(due) < 0;
      return `<div class="list-row">
        <button type="button" data-paid="${i.id}" aria-pressed="${!!paid[i.id]}" aria-label="Markera ${esc(i.name)} som betald" style="width:44px;height:44px;margin-left:-8px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer">
          <span style="width:26px;height:26px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:#fff;background:${paid[i.id] ? 'var(--accent)' : '#fff'};border:2px solid ${paid[i.id] ? 'var(--accent)' : '#C9C3B8'}">${icon('check', 14, 3.2)}</span></button>
        <button type="button" data-item="${i.id}" class="grow stack" style="gap:2px;border:0;background:none;text-align:left;padding:0;cursor:pointer">
          <span class="title" style="${paid[i.id] ? 'color:var(--muted)' : ''}">${esc(i.name)}</span>
          <span class="sub">${paid[i.id] ? 'Betald' : late ? '<span style="color:var(--pink-ink);font-weight:600">Sista dag passerad</span>' : 'Senast ' + esc(fmtShort(due))} · ${esc(i.category)}</span>
        </button>
        <span class="num" style="font-weight:700">${kr(i.amount)}</span>
      </div>`;
    };

    el.innerHTML = `<div class="screen">
      <h1>Budget</h1>
      ${ctx.spaceBar()}
      <div class="between">
        <button class="icon-btn" data-prev aria-label="Förra månaden">${icon('back', 20, 2.2)}</button>
        <b style="font-size:18px">${cap(MONTHS[m - 1])} ${y}</b>
        <button class="icon-btn" data-next aria-label="Nästa månad">${icon('right', 20, 2.2)}</button>
      </div>
      <section class="card stack-lg">
        <div class="stack" style="gap:4px"><span class="muted" style="font-size:14px;font-weight:600">Kvar efter räkningar</span>
          <span class="big num" style="font-size:42px;color:${S.left < 0 ? 'var(--pink-ink)' : 'var(--ink)'}">${kr(S.left)}</span></div>
        <div class="grid2">
          <div><div class="small muted">Inkomster</div><b class="num" style="font-size:18px">${kr(S.income)}</b></div>
          <div><div class="small muted">Utgifter</div><b class="num" style="font-size:18px">${kr(S.expense)}</b></div>
        </div>
        ${S.exp.length ? `<div class="stack" style="gap:6px">
          <div class="progress"><span style="width:${(S.paidCount / S.exp.length) * 100}%"></span></div>
          <span class="small muted">${S.paidCount} av ${S.exp.length} räkningar betalda${S.unpaidSum ? ` · ${kr(S.unpaidSum)} kvar att betala` : ''}</span></div>` : ''}
      </section>
      <div class="btn-row"><button class="btn outline" data-add="expense">${icon('plus', 18, 2.2)}Utgift</button><button class="btn outline" data-add="income">${icon('plus', 18, 2.2)}Inkomst</button></div>
      <section class="stack"><h2>Räkningar och utgifter</h2>
        ${S.exp.length ? `<div class="card flush">${S.exp.map(billRow).join('')}</div>` : '<div class="card empty">Inga utgifter den här månaden.<br>Lägg in hyra, el, försäkringar och abonnemang.</div>'}
      </section>
      <section class="stack"><h2>Inkomster</h2>
        ${S.inc.length ? `<div class="card flush">${S.inc.map((i) => `<button class="list-row" data-item="${i.id}"><span class="grow stack" style="gap:2px"><span class="title">${esc(i.name)}</span><span class="sub">Den ${i.day} · ${esc(i.category)}</span></span><span class="num" style="font-weight:700;color:var(--accent-dark)">${kr(i.amount)}</span></button>`).join('')}</div>` : '<div class="card empty">Inga inkomster inlagda.</div>'}
      </section>
      ${cats.length ? `<section class="card stack"><h2>Per kategori</h2>
        ${cats.map(([c, v]) => `<div class="stack" style="gap:4px;margin-top:6px"><div class="between small"><span style="font-weight:600">${esc(c)}</span><span class="num">${kr(v)}</span></div>
          <div class="progress" style="height:8px"><span style="width:${(v / max) * 100}%;background:var(--pink)"></span></div></div>`).join('')}
      </section>` : ''}
    </div>`;

    el.querySelector('[data-prev]').addEventListener('click', () => { m--; if (m < 1) { m = 12; y--; } draw(); });
    el.querySelector('[data-next]').addEventListener('click', () => { m++; if (m > 12) { m = 1; y++; } draw(); });
    const reload = async () => { items = await loadItems(space.id); draw(); };
    el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => openItemEditor(ctx, b.dataset.add, null, reload)));
    el.querySelectorAll('[data-item]').forEach((b) => b.addEventListener('click', () => openItemEditor(ctx, null, items.find((i) => i.id === b.dataset.item), reload)));
    el.querySelectorAll('[data-paid]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.paid;
      try { await setPaid(space.id, ym, id, !paid[id]); draw(); } catch (ex) { toast(errorText(ex)); }
    }));
    ctx.wireSpaceBar(el);
  };
  await draw();
}
