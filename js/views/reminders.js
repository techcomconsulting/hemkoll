// Påminnelser, t.ex. byt filter, besiktning, förnya försäkring.
import { loadReminders, saveReminder, deleteReminder } from '../data.js';
import { esc, icon, backLink, openSheet, confirmSheet, toast, busy, errorText } from '../ui.js';
import { today, addMonths, whenText, daysUntil } from '../dates.js';
import { spaceSelect } from './binder.js';

export const REPEATS = [[0, 'Ingen upprepning'], [1, 'Varje månad'], [3, 'Var tredje månad'], [6, 'Varje halvår'], [12, 'Varje år']];
export const repeatText = (n) => (REPEATS.find((r) => r[0] === n) || REPEATS[0])[1];

export function openReminderEditor(ctx, existing = null, onSaved = null) {
  const r = existing || { next: today(), repeat: 0 };
  const s = openSheet(`
    <h2>${existing ? 'Ändra påminnelse' : 'Ny påminnelse'}</h2>
    <div class="field"><label for="rt">Vad ska göras?</label><input class="input" id="rt" maxlength="80" value="${esc(r.title || '')}" placeholder="t.ex. Byt filter i fläkten"></div>
    <div class="field"><label for="rn">När?</label><input class="input" id="rn" type="date" value="${esc(r.next)}"></div>
    <div class="field"><label for="rr">Upprepa</label><select class="input" id="rr">
      ${REPEATS.map(([v, l]) => `<option value="${v}" ${v === (r.repeat || 0) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label for="rno">Anteckning (valfritt)</label><textarea class="input" id="rno" maxlength="500">${esc(r.note || '')}</textarea></div>
    ${existing ? '' : spaceSelect(ctx, ctx.state.spaceId)}
    <p class="error hidden" role="alert">Skriv vad som ska göras.</p>
    <div class="btn-row">${existing ? '<button class="btn danger-outline" data-del>Ta bort</button>' : '<button class="btn" data-close>Avbryt</button>'}<button class="btn primary" data-save>Spara</button></div>`, 'Påminnelse');
  s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
    const title = s.el.querySelector('#rt').value.trim();
    if (!title) { s.el.querySelector('.error').classList.remove('hidden'); return; }
    const sid = s.el.querySelector('#sp')?.value || ctx.state.spaceId;
    const data = { title, next: s.el.querySelector('#rn').value || today(), repeat: Number(s.el.querySelector('#rr').value), note: s.el.querySelector('#rno').value.trim() };
    await busy(e.currentTarget, async () => {
      try {
        await saveReminder(existing ? ctx.state.spaceId : sid, data, existing?.id);
        s.close();
        toast('Påminnelsen är sparad.');
        if (!existing && sid !== ctx.state.spaceId) ctx.setSpace(sid);
        else if (onSaved) onSaved(); else ctx.rerender();
      } catch (ex) { toast(errorText(ex)); }
    });
  });
  const del = s.el.querySelector('[data-del]');
  if (del) del.addEventListener('click', async () => {
    s.close();
    if (!(await confirmSheet({ title: 'Ta bort påminnelsen?', ok: 'Ta bort', danger: true }))) return;
    try { await deleteReminder(ctx.state.spaceId, existing.id); if (onSaved) onSaved(); else ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
  });
}

// Markera som klar: flytta fram om den upprepas, annars ta bort.
export async function completeReminder(ctx, r) {
  const sid = ctx.state.spaceId;
  if (r.repeat) {
    let next = addMonths(r.next, r.repeat);
    while (daysUntil(next) < 0) next = addMonths(next, r.repeat);
    await saveReminder(sid, { next, lastDone: today() }, r.id);
    toast(`Klart! Nästa gång: ${whenText(next).toLowerCase()}.`);
  } else {
    await deleteReminder(sid, r.id);
    toast('Klart!');
  }
}

export function reminderRow(r) {
  const n = daysUntil(r.next);
  const color = n < 0 ? 'var(--pink-ink)' : n <= 7 ? 'var(--accent-dark)' : 'var(--muted)';
  return `<div class="list-row">
    <button type="button" data-done="${r.id}" aria-label="Markera ${esc(r.title)} som klar" style="width:44px;height:44px;margin-left:-8px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer">
      <span style="width:26px;height:26px;border-radius:13px;border:2px solid #C9C3B8;display:flex;align-items:center;justify-content:center;color:transparent">${icon('check', 14, 3.2)}</span></button>
    <button type="button" data-edit="${r.id}" class="grow stack" style="gap:2px;border:0;background:none;text-align:left;padding:0;cursor:pointer">
      <span class="title">${esc(r.title)}</span>
      <span class="sub"><span style="color:${color};font-weight:600">${esc(n < 0 ? 'Försenad · ' + whenText(r.next) : whenText(r.next))}</span>${r.repeat ? ' · ' + esc(repeatText(r.repeat)) : ''}</span>
    </button>
  </div>`;
}

export function wireReminderRows(el, ctx, list, onChange) {
  el.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', async () => {
    const r = list.find((x) => x.id === b.dataset.done);
    try { await completeReminder(ctx, r); onChange(); } catch (ex) { toast(errorText(ex)); }
  }));
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    openReminderEditor(ctx, list.find((x) => x.id === b.dataset.edit), onChange);
  }));
}

export async function remindersView(el, ctx) {
  const space = ctx.space();
  if (!space) { ctx.go('/'); return; }
  const list = await loadReminders(space.id);
  el.innerHTML = `<div class="screen">
    ${backLink('#/', 'Översikt')}
    <div class="between"><h1>Påminnelser</h1><button class="btn primary sm" data-add>${icon('plus', 18, 2.2)}Ny</button></div>
    ${ctx.spaceBar()}
    ${list.length ? `<div class="card flush">${list.map(reminderRow).join('')}</div>`
      : '<div class="card empty">Inga påminnelser.<br>T.ex. byta filter, besiktning eller förnya en försäkring.</div>'}
    <p class="small muted">Tryck på rundeln när det är gjort. Upprepade påminnelser flyttas fram automatiskt.</p>
  </div>`;
  el.querySelector('[data-add]').addEventListener('click', () => openReminderEditor(ctx));
  wireReminderRows(el, ctx, list, () => ctx.rerender());
  ctx.wireSpaceBar(el);
}
