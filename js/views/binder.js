// Pärmen: kvitton, garantier, försäkringar, bruksanvisningar.
import {
  DOC_CATS, loadDocs, getDocument, saveDocument, deleteDocument, loadFiles, addFile, deleteFile
} from '../data.js';
import { esc, icon, kr, parseNum, backLink, openSheet, confirmSheet, toast, busy, errorText, resizeImage } from '../ui.js';
import { today, fmtShort, fmtFull, daysUntil } from '../dates.js';

export const catInfo = (k) => DOC_CATS.find((c) => c[0] === k) || DOC_CATS[DOC_CATS.length - 1];

export function warrantyChip(d) {
  if (!d.warrantyUntil) return '';
  const n = daysUntil(d.warrantyUntil);
  if (n < 0) return `<span class="chip neutral" style="font-size:12px;padding:3px 8px">Garantin har gått ut</span>`;
  if (n <= 60) return `<span class="chip warn" style="font-size:12px;padding:3px 8px">Garanti ${n} dagar kvar</span>`;
  return `<span class="chip good" style="font-size:12px;padding:3px 8px">Garanti till ${esc(fmtShort(d.warrantyUntil))}</span>`;
}

function docRow(d) {
  const [, label, ic] = catInfo(d.category);
  const bits = [label, d.date ? fmtShort(d.date) : '', d.amount ? kr(d.amount) : '', d.place || ''].filter(Boolean);
  return `<a class="list-row" href="#/parm/${d.id}">
    <span style="width:40px;height:40px;border-radius:12px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(ic, 22)}</span>
    <span class="grow stack" style="gap:3px">
      <span class="title">${esc(d.title)}</span>
      <span class="sub">${esc(bits.join(' · '))}${d.fileCount ? ` · ${d.fileCount} ${d.fileCount === 1 ? 'bild' : 'bilder'}` : ''}</span>
      ${warrantyChip(d) ? `<span>${warrantyChip(d)}</span>` : ''}
    </span>
    ${icon('right', 18, 2)}
  </a>`;
}

function spaceSelect(ctx, current) {
  const spaces = ctx.state.spaces;
  if (spaces.length < 2) return '';
  return `<div class="field"><label for="sp">Spara i</label><select class="input" id="sp">
    ${spaces.map((s) => `<option value="${s.id}" ${s.id === current ? 'selected' : ''}>${esc(s.name)}${s.personal ? ' (bara du)' : ''}</option>`).join('')}
  </select></div>`;
}
export { spaceSelect };

export function openDocEditor(ctx, existing = null, presetCat = 'receipt', onSaved = null) {
  const d = existing || { category: presetCat, date: today() };
  const s = openSheet(`
    <h2>${existing ? 'Ändra' : 'Lägg till i pärmen'}</h2>
    <div class="field"><label for="dt">Vad är det?</label><input class="input" id="dt" maxlength="80" value="${esc(d.title || '')}" placeholder="t.ex. Diskmaskin Bosch"></div>
    <div class="field"><label for="dc">Typ</label><select class="input" id="dc">
      ${DOC_CATS.map(([k, l]) => `<option value="${k}" ${k === d.category ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${existing ? '' : `<label class="btn outline block" style="border-style:dashed">${icon('camera', 20)}<span data-pics>Ta bild eller välj bilder</span>
      <input type="file" accept="image/*" multiple class="hidden" data-files></label>`}
    <div class="grid2">
      <div class="field"><label for="dd">Datum</label><input class="input" id="dd" type="date" value="${esc(d.date || '')}"></div>
      <div class="field"><label for="da">Belopp (kr)</label><input class="input" id="da" inputmode="decimal" value="${d.amount ?? ''}"></div>
    </div>
    <div class="field"><label for="dp">Butik eller företag</label><input class="input" id="dp" maxlength="60" value="${esc(d.place || '')}"></div>
    <div class="field"><label for="dw">Garanti gäller till (valfritt)</label><input class="input" id="dw" type="date" value="${esc(d.warrantyUntil || '')}">
      <span class="hint">Du får en påminnelse på översikten innan den går ut.</span></div>
    <div class="field"><label for="dn">Anteckning (valfritt)</label><textarea class="input" id="dn" maxlength="1000">${esc(d.note || '')}</textarea></div>
    ${existing || onSaved ? '' : spaceSelect(ctx, ctx.state.spaceId)}
    <p class="error hidden" role="alert">Skriv vad det är.</p>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Pärm');

  let files = [];
  const fileInput = s.el.querySelector('[data-files]');
  if (fileInput) fileInput.addEventListener('change', (e) => {
    files = [...e.target.files];
    s.el.querySelector('[data-pics]').textContent = files.length ? `${files.length} ${files.length === 1 ? 'bild vald' : 'bilder valda'} ✓` : 'Ta bild eller välj bilder';
  });

  s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
    const title = s.el.querySelector('#dt').value.trim();
    if (!title) { s.el.querySelector('.error').classList.remove('hidden'); return; }
    const sid = s.el.querySelector('#sp')?.value || ctx.state.spaceId;
    const data = {
      title, category: s.el.querySelector('#dc').value,
      date: s.el.querySelector('#dd').value || null,
      amount: parseNum(s.el.querySelector('#da').value),
      place: s.el.querySelector('#dp').value.trim(),
      warrantyUntil: s.el.querySelector('#dw').value || null,
      note: s.el.querySelector('#dn').value.trim()
    };
    await busy(e.currentTarget, async () => {
      try {
        const id = await saveDocument(existing ? ctx.state.spaceId : sid, data, existing?.id);
        let count = existing?.fileCount || 0;
        for (const f of files) { await addFile(sid, id, await resizeImage(f, 1600, 0.75), count); count++; }
        s.close();
        toast('Sparat i pärmen.');
        if (onSaved) { await onSaved(id); return; }
        if (!existing && sid !== ctx.state.spaceId) { ctx.setSpace(sid); }
        ctx.go('/parm/' + id);
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}

export async function binderView(el, ctx) {
  const space = ctx.space();
  if (!space) { ctx.go('/'); return; }
  const docs = await loadDocs(space.id);
  let cat = 'all';
  let q = '';

  el.innerHTML = `<div class="screen">
    <div class="between"><h1>Pärm</h1><button class="btn primary sm" data-add>${icon('plus', 18, 2.2)}Lägg till</button></div>
    ${ctx.spaceBar()}
    <div class="row" style="gap:8px;background:#fff;border:1px solid var(--field-line);border-radius:14px;padding:0 12px">
      <span class="muted">${icon('search', 20)}</span>
      <label for="q" class="sr hidden">Sök</label>
      <input id="q" type="search" placeholder="Sök i pärmen" style="flex:1;height:48px;border:0;outline:none;background:transparent;font-size:16px" aria-label="Sök i pärmen">
    </div>
    <div class="pills" role="group" aria-label="Typ">
      <button type="button" data-cat="all" aria-pressed="true">Alla</button>
      ${DOC_CATS.map(([k, l]) => `<button type="button" data-cat="${k}" aria-pressed="false">${l}</button>`).join('')}
    </div>
    <div data-list></div>
  </div>`;

  const list = el.querySelector('[data-list]');
  const draw = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = docs.filter((d) => (cat === 'all' || d.category === cat)
      && words.every((w) => [d.title, d.place, d.note].join(' ').toLowerCase().includes(w)));
    list.innerHTML = shown.length ? `<div class="card flush">${shown.map(docRow).join('')}</div>`
      : docs.length ? '<div class="card empty">Inget hittades.</div>'
        : `<div class="card empty">Pärmen är tom.<br>Fota ett kvitto eller en garanti och spara här.</div>`;
  };
  draw();
  el.querySelector('#q').addEventListener('input', (e) => { q = e.target.value; draw(); });
  el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    cat = b.dataset.cat;
    el.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  el.querySelector('[data-add]').addEventListener('click', () => openDocEditor(ctx, null, cat === 'all' ? 'receipt' : cat));
  ctx.wireSpaceBar(el);
}

export async function docView(el, ctx, id) {
  const space = ctx.space();
  const d = space ? await getDocument(space.id, id) : null;
  if (!d) { el.innerHTML = `<div class="screen">${backLink('#/parm', 'Pärm')}<div class="card empty">Hittade inte dokumentet.</div></div>`; return; }
  const files = await loadFiles(space.id, id);
  const [, label, ic] = catInfo(d.category);
  const row = (l, v) => (v ? `<div class="between" style="padding:11px 0;border-top:1px solid var(--line)"><span class="muted">${l}</span><span style="font-weight:600;text-align:right">${v}</span></div>` : '');

  el.innerHTML = `<div class="screen">
    ${backLink('#/parm', 'Pärm')}
    <div class="row" style="gap:14px">
      <span style="width:52px;height:52px;border-radius:14px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(ic, 28)}</span>
      <div class="stack" style="gap:2px"><h1 style="font-size:24px">${esc(d.title)}</h1><span class="muted small">${esc(label)} · ${esc(space.name)}</span></div>
    </div>
    ${warrantyChip(d)}
    <section class="card" style="padding:4px 16px 8px">
      ${row('Datum', esc(fmtFull(d.date)))}
      ${row('Belopp', d.amount ? kr(d.amount) : '')}
      ${row('Butik / företag', esc(d.place))}
      ${row('Garanti till', esc(fmtFull(d.warrantyUntil)))}
      ${d.note ? `<div style="padding:11px 0;border-top:1px solid var(--line);white-space:pre-wrap">${esc(d.note)}</div>` : ''}
    </section>
    <section class="stack"><h2>Bilder</h2>
      ${files.length ? `<div class="thumbs">${files.map((f) => `<button type="button" data-file="${f.id}"><img class="photo" src="${f.data}" alt="Bild på ${esc(d.title)}"></button>`).join('')}</div>` : '<p class="small muted">Inga bilder än.</p>'}
      <label class="btn outline block">${icon('camera', 20)}Lägg till bild<input type="file" accept="image/*" multiple class="hidden" data-upload></label>
    </section>
    <div class="btn-row"><button class="btn danger-outline" data-del>Ta bort</button><button class="btn primary" data-edit>${icon('edit', 18)}Ändra</button></div>
  </div>`;

  el.querySelector('[data-edit]').addEventListener('click', () => openDocEditor(ctx, d));
  el.querySelector('[data-del]').addEventListener('click', async () => {
    if (!(await confirmSheet({ title: `Ta bort ${d.title}?`, text: 'Bilderna tas också bort.', ok: 'Ta bort', danger: true }))) return;
    try { await deleteDocument(space.id, id); toast('Borttaget.'); ctx.go('/parm'); } catch (ex) { toast(errorText(ex)); }
  });
  el.querySelector('[data-upload]').addEventListener('change', async (e) => {
    const list = [...e.target.files];
    if (!list.length) return;
    toast('Sparar…');
    try {
      let count = d.fileCount || 0;
      for (const f of list) { await addFile(space.id, id, await resizeImage(f, 1600, 0.75), count); count++; }
      ctx.rerender();
    } catch (ex) { toast(errorText(ex)); }
  });
  el.querySelectorAll('[data-file]').forEach((b) => b.addEventListener('click', () => {
    const f = files.find((x) => x.id === b.dataset.file);
    const s = openSheet(`<img src="${f.data}" alt="" style="width:100%;border-radius:12px">
      <div class="btn-row"><button class="btn danger-outline" data-rm>Ta bort bilden</button><button class="btn" data-close>Stäng</button></div>`, 'Bild');
    s.el.querySelector('[data-rm]').addEventListener('click', async () => {
      s.close();
      if (!(await confirmSheet({ title: 'Ta bort bilden?', ok: 'Ta bort', danger: true }))) return;
      try { await deleteFile(space.id, id, f.id, d.fileCount || files.length); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
    });
  }));
}
