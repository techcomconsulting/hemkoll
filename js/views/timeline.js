// Tidslinjen: husets historia. Renoveringar, nya köp, service.
// Kan delas med en ny ägare via en länk.
import {
  EVENT_KINDS, loadEvents, getEvent, saveEvent, deleteEvent, loadEventFiles, addEventFile, deleteEventFile,
  setEventDocs, loadDocs, createShare, loadMyShares, deleteShare, getShare, importShare
} from '../data.js';
import { esc, icon, kr, parseNum, backLink, openSheet, confirmSheet, toast, busy, errorText, resizeImage } from '../ui.js';
import { today, fmtShort, fmtFull } from '../dates.js';
import { openDocEditor, catInfo } from './binder.js';

export const kindInfo = (k) => EVENT_KINDS.find((c) => c[0] === k) || EVENT_KINDS[EVENT_KINDS.length - 1];
const iconBox = (ic, size = 40) => `<span style="width:${size}px;height:${size}px;border-radius:${size > 44 ? 14 : 12}px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(ic, Math.round(size * 0.55))}</span>`;
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : '');
const shareUrl = (token) => location.origin + location.pathname + '#/delning/' + token;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- Lägg till / ändra ----------

export function openEventEditor(ctx, existing = null, onSaved = null) {
  const e = existing || { kind: 'renovation', date: today() };
  const s = openSheet(`
    <h2>${existing ? 'Ändra händelse' : 'Ny händelse'}</h2>
    <div class="field"><label for="et">Vad hände?</label><input class="input" id="et" maxlength="80" value="${esc(e.title || '')}" placeholder="t.ex. Nytt kylskåp"></div>
    <div class="grid2">
      <div class="field"><label for="ek">Typ</label><select class="input" id="ek">
        ${EVENT_KINDS.map(([k, l]) => `<option value="${k}" ${k === e.kind ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="ed">Datum</label><input class="input" id="ed" type="date" value="${esc(e.date || '')}"></div>
    </div>
    ${existing ? '' : `<label class="btn outline block" style="border-style:dashed">${icon('camera', 20)}<span data-pics>Lägg till bilder</span>
      <input type="file" accept="image/*" multiple class="hidden" data-files></label>`}
    <div class="field"><label for="ec">Kostnad i kr (valfritt)</label><input class="input" id="ec" inputmode="decimal" value="${e.cost ?? ''}"></div>
    <div class="field"><label for="el">Länk till bruksanvisning (valfritt)</label><input class="input" id="el" type="url" inputmode="url" autocapitalize="none" value="${esc(e.link || '')}" placeholder="https://…">
      <span class="hint">Klistra in länken från tillverkarens hemsida.</span></div>
    <div class="field"><label for="en">Anteckning (valfritt)</label><textarea class="input" id="en" maxlength="1500" placeholder="t.ex. Vilken firma, färgkod, material">${esc(e.note || '')}</textarea></div>
    <p class="error hidden" role="alert">Skriv vad som hände.</p>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Händelse');

  let files = [];
  s.el.querySelector('[data-files]')?.addEventListener('change', (ev) => {
    files = [...ev.target.files];
    s.el.querySelector('[data-pics]').textContent = files.length ? `${plural(files.length, 'bild vald', 'bilder valda')} ✓` : 'Lägg till bilder';
  });

  s.el.querySelector('[data-save]').addEventListener('click', async (ev) => {
    const title = s.el.querySelector('#et').value.trim();
    if (!title) { s.el.querySelector('.error').classList.remove('hidden'); return; }
    let link = s.el.querySelector('#el').value.trim();
    if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
    const data = {
      title, kind: s.el.querySelector('#ek').value,
      date: s.el.querySelector('#ed').value || today(),
      cost: parseNum(s.el.querySelector('#ec').value),
      link, note: s.el.querySelector('#en').value.trim()
    };
    const sid = ctx.state.spaceId;
    await busy(ev.currentTarget, async () => {
      try {
        const id = await saveEvent(sid, data, existing?.id);
        let n = existing?.fileCount || 0;
        for (const f of files) { await addEventFile(sid, id, await resizeImage(f, 1600, 0.75), n); n++; }
        s.close();
        toast('Sparat i tidslinjen.');
        if (onSaved) onSaved(id); else ctx.go('/tidslinje/' + id);
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}

// ---------- Listan ----------

function eventRow(e) {
  const [, label, ic] = kindInfo(e.kind);
  const bits = [label, e.fileCount ? plural(e.fileCount, 'bild', 'bilder') : '', e.docIds?.length ? plural(e.docIds.length, 'kvitto', 'kvitton') : ''].filter(Boolean);
  return `<a class="hl-item" href="#/tidslinje/${e.id}">
    <span class="hl-dot">${icon(ic, 18)}</span>
    <span class="grow stack" style="gap:2px">
      <span class="small muted" style="font-weight:600">${esc(fmtShort(e.date))}</span>
      <span class="title">${esc(e.title)}</span>
      <span class="sub">${esc(bits.join(' · '))}</span>
    </span>
    ${icon('right', 18, 2)}
  </a>`;
}

export async function timelineView(el, ctx) {
  const space = ctx.space();
  if (!space) { ctx.go('/'); return; }
  const [events, shares] = await Promise.all([loadEvents(space.id), loadMyShares(space.id).catch(() => [])]);

  const years = [];
  for (const e of events) {
    const y = String(e.date || '').slice(0, 4) || '–';
    if (!years.length || years[years.length - 1].y !== y) years.push({ y, list: [] });
    years[years.length - 1].list.push(e);
  }

  el.innerHTML = `<div class="screen">
    <div class="between"><h1>Tidslinje</h1><button class="btn primary sm" data-add>${icon('plus', 18, 2.2)}Lägg till</button></div>
    ${ctx.spaceBar()}
    ${events.length ? years.map((g) => `<section class="stack">
        <span class="section-title">${esc(g.y)}</span>
        <div class="card hl">${g.list.map(eventRow).join('')}</div>
      </section>`).join('')
      : `<div class="card empty stack-lg" style="align-items:center">
          <span style="color:var(--accent)">${icon('clock', 40, 1.6)}</span>
          <span>Här samlar du husets historia.<br>Renoveringar, nya vitvaror, service.</span>
        </div>`}

    ${events.length ? `<section class="stack"><h2>Säljer du huset?</h2>
      <p class="small muted">Dela tidslinjen med den nya ägaren. Hen får en länk och kan spara allt i sin egen Hemkoll.</p>
      <button class="btn outline block" data-share>${icon('share', 20)}Dela med ny ägare</button>
      ${shares.length ? `<div class="card flush">${shares.map((sh) => `<div class="list-row">
          <span style="color:var(--accent)">${icon('link', 22)}</span>
          <span class="grow stack" style="gap:2px"><span class="title">${esc(sh.house)}</span><span class="sub">${plural((sh.events || []).length, 'händelse', 'händelser')}</span></span>
          <button class="btn sm" data-copy="${sh.id}">Skicka</button>
          <button class="btn sm danger-outline" data-stop="${sh.id}" aria-label="Stoppa länken">${icon('trash', 18)}</button>
        </div>`).join('')}</div>` : ''}
    </section>` : ''}
  </div>`;

  el.querySelector('[data-add]').addEventListener('click', () => openEventEditor(ctx));
  el.querySelector('[data-share]')?.addEventListener('click', () => openShareSheet(ctx, space, events));
  el.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => {
    const sh = shares.find((x) => x.id === b.dataset.copy);
    sendLink(sh.id, sh.house);
  }));
  el.querySelectorAll('[data-stop]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmSheet({ title: 'Stoppa länken?', text: 'Länken slutar fungera. Har köparen redan sparat loggen finns den kvar hos hen.', ok: 'Stoppa', danger: true }))) return;
    try { await deleteShare(b.dataset.stop); toast('Länken är stoppad.'); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
  }));
  ctx.wireSpaceBar(el);
}

// ---------- En händelse ----------

export async function eventView(el, ctx, id) {
  const space = ctx.space();
  const e = space ? await getEvent(space.id, id) : null;
  if (!e) { el.innerHTML = `<div class="screen">${backLink('#/tidslinje', 'Tidslinje')}<div class="card empty">Hittade inte händelsen.</div></div>`; return; }
  const [files, allDocs] = await Promise.all([loadEventFiles(space.id, id), loadDocs(space.id)]);
  const linked = allDocs.filter((d) => (e.docIds || []).includes(d.id));
  const [, label, ic] = kindInfo(e.kind);
  const row = (l, v) => (v ? `<div class="between" style="padding:11px 0;border-top:1px solid var(--line)"><span class="muted">${l}</span><span style="font-weight:600;text-align:right">${v}</span></div>` : '');
  const link = safeUrl(e.link);

  el.innerHTML = `<div class="screen">
    ${backLink('#/tidslinje', 'Tidslinje')}
    <div class="row" style="gap:14px">${iconBox(ic, 52)}
      <div class="stack" style="gap:2px"><h1 style="font-size:24px">${esc(e.title)}</h1><span class="muted small">${esc(label)} · ${esc(fmtFull(e.date))}</span></div>
    </div>
    ${e.cost || e.note ? `<section class="card" style="padding:4px 16px 8px">
      ${row('Kostnad', e.cost ? kr(e.cost) : '')}
      ${e.note ? `<div style="padding:11px 0;border-top:1px solid var(--line);white-space:pre-wrap">${esc(e.note)}</div>` : ''}
    </section>` : ''}
    ${link ? `<a class="btn outline block" href="${esc(link)}" target="_blank" rel="noopener">${icon('book', 20)}Öppna bruksanvisningen</a>` : ''}

    <section class="stack"><h2>Bilder</h2>
      ${files.length ? `<div class="thumbs">${files.map((f) => `<button type="button" data-file="${f.id}"><img class="photo" src="${f.data}" alt="Bild på ${esc(e.title)}"></button>`).join('')}</div>` : '<p class="small muted">Inga bilder än.</p>'}
      <label class="btn outline block">${icon('camera', 20)}Lägg till bild<input type="file" accept="image/*" multiple class="hidden" data-upload></label>
    </section>

    <section class="stack"><h2>Kvitton och manualer</h2>
      ${linked.length ? `<div class="card flush">${linked.map((d) => {
        const [, cl, cic] = catInfo(d.category);
        return `<a class="list-row" href="#/parm/${d.id}">${iconBox(cic)}
          <span class="grow stack" style="gap:2px"><span class="title">${esc(d.title)}</span><span class="sub">${esc([cl, d.date ? fmtShort(d.date) : ''].filter(Boolean).join(' · '))}</span></span>${icon('right', 18, 2)}</a>`;
      }).join('')}</div>` : '<p class="small muted">Inget kopplat än.</p>'}
      <div class="btn-row">
        <button class="btn outline" data-new-doc>${icon('plus', 18, 2.2)}Nytt</button>
        <button class="btn outline" data-link>${icon('folder', 18)}Från pärmen</button>
      </div>
    </section>

    <div class="btn-row"><button class="btn danger-outline" data-del>Ta bort</button><button class="btn primary" data-edit>${icon('edit', 18)}Ändra</button></div>
  </div>`;

  el.querySelector('[data-edit]').addEventListener('click', () => openEventEditor(ctx, e, () => ctx.rerender()));
  el.querySelector('[data-del]').addEventListener('click', async () => {
    if (!(await confirmSheet({ title: `Ta bort ${e.title}?`, text: 'Bilderna tas också bort. Kvitton i pärmen finns kvar.', ok: 'Ta bort', danger: true }))) return;
    try { await deleteEvent(space.id, id); toast('Borttaget.'); ctx.go('/tidslinje'); } catch (ex) { toast(errorText(ex)); }
  });
  el.querySelector('[data-upload]').addEventListener('change', async (ev) => {
    const list = [...ev.target.files];
    if (!list.length) return;
    toast('Sparar…');
    try {
      let n = e.fileCount || 0;
      for (const f of list) { await addEventFile(space.id, id, await resizeImage(f, 1600, 0.75), n); n++; }
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
      try { await deleteEventFile(space.id, id, f.id, e.fileCount || files.length); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
    });
  }));

  // Nytt kvitto eller manual: sparas i pärmen och kopplas hit.
  el.querySelector('[data-new-doc]').addEventListener('click', () => {
    openDocEditor(ctx, null, 'receipt', async (docId) => {
      await setEventDocs(space.id, id, [...(e.docIds || []), docId]);
      ctx.rerender();
    });
  });

  // Välj från pärmen (bocka i och ur).
  el.querySelector('[data-link]').addEventListener('click', () => {
    if (!allDocs.length) { toast('Pärmen är tom. Tryck på Nytt.'); return; }
    const chosen = new Set(e.docIds || []);
    const s = openSheet(`<h2>Koppla från pärmen</h2>
      <div class="card flush" style="box-shadow:none;border:1px solid var(--line);max-height:50vh;overflow:auto">
        ${allDocs.map((d) => `<label class="list-row" style="cursor:pointer">
          <input type="checkbox" data-doc="${d.id}" ${chosen.has(d.id) ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--accent)">
          <span class="grow stack" style="gap:2px"><span class="title">${esc(d.title)}</span><span class="sub">${esc([catInfo(d.category)[1], d.date ? fmtShort(d.date) : ''].filter(Boolean).join(' · '))}</span></span>
        </label>`).join('')}
      </div>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Koppla');
    s.el.querySelector('[data-save]').addEventListener('click', async (ev) => {
      const ids = [...s.el.querySelectorAll('[data-doc]:checked')].map((c) => c.dataset.doc);
      await busy(ev.currentTarget, async () => {
        try { await setEventDocs(space.id, id, ids); s.close(); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
      });
    });
  });
}

// ---------- Dela ----------

async function sendLink(token, house) {
  const url = shareUrl(token);
  if (navigator.share) {
    try { await navigator.share({ title: `Husets historia – ${house}`, text: 'Här är husets historia i Hemkoll.', url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Länken är kopierad.'); return; } catch { /* visa den i stället */ }
  const s = openSheet(`<h2>Länken</h2><input class="input" readonly value="${esc(url)}"><button class="btn block" data-close>Stäng</button>`, 'Länk');
  s.el.querySelector('input').select();
}

function openShareSheet(ctx, space, events) {
  const s = openSheet(`
    <h2>Dela med ny ägare</h2>
    <p class="small muted">Köparen får en kopia. Det du ändrar sen syns inte hos hen.</p>
    <div class="field"><label for="hn">Husets namn</label><input class="input" id="hn" maxlength="30" value="${esc(space.personal ? '' : space.name)}" placeholder="t.ex. Villa Ekvägen 4"></div>
    <div class="stack"><span style="font-size:14px;font-weight:600">Vad ska med?</span>
      <div class="card flush" style="box-shadow:none;border:1px solid var(--line);max-height:40vh;overflow:auto">
        ${events.map((e) => `<label class="list-row" style="cursor:pointer;min-height:52px">
          <input type="checkbox" data-ev="${e.id}" checked style="width:22px;height:22px;accent-color:var(--accent)">
          <span class="grow stack" style="gap:2px"><span class="title" style="font-size:15px">${esc(e.title)}</span><span class="sub">${esc(fmtShort(e.date))} ${esc(String(e.date || '').slice(0, 4))}</span></span>
        </label>`).join('')}
      </div>
    </div>
    <label class="check"><input type="checkbox" id="wm">Visa kostnader och belopp</label>
    <p class="hint">Kopplade kvitton och manualer följer med.</p>
    <p class="error hidden" role="alert"></p>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-go>Skapa länk</button></div>`, 'Dela');

  s.el.querySelector('[data-go]').addEventListener('click', async (ev) => {
    const err = s.el.querySelector('.error');
    const house = s.el.querySelector('#hn').value.trim();
    const eventIds = [...s.el.querySelectorAll('[data-ev]:checked')].map((c) => c.dataset.ev);
    if (!house) { err.textContent = 'Skriv husets namn.'; err.classList.remove('hidden'); return; }
    if (!eventIds.length) { err.textContent = 'Välj minst en händelse.'; err.classList.remove('hidden'); return; }
    await busy(ev.currentTarget, async () => {
      try {
        const token = await createShare(space.id, {
          house, fromName: ctx.state.profile?.firstName || '', eventIds, withAmounts: s.el.querySelector('#wm').checked
        });
        s.close();
        const done = openSheet(`<h2>Länken är klar!</h2>
          <p class="muted">Skicka den till köparen. Hen kan se allt och spara det i sin egen Hemkoll.</p>
          <button class="btn primary block" data-send>${icon('share', 20)}Skicka länken</button>
          <button class="btn block" data-close>Klar</button>`, 'Klar');
        done.el.querySelector('[data-send]').addEventListener('click', () => sendLink(token, house));
        ctx.rerender();
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}

// ---------- Sidan köparen ser ----------

export const PENDING_IMPORT = 'hk-import';

export async function shareView(el, ctx, token) {
  const sh = await getShare(token).catch(() => null);
  const loggedIn = !!ctx.state.user;
  const top = loggedIn ? backLink('#/', 'Hemkoll') : `<div class="row" style="gap:10px"><img src="icons/icon-192.png" alt="" width="36" height="36" style="border-radius:10px"><b>Hemkoll</b></div>`;
  if (!sh) {
    el.innerHTML = `<div class="screen no-nav">${top}<div class="card empty">Länken fungerar inte längre.<br>Be säljaren skicka en ny.</div>
      ${loggedIn ? '' : '<a class="btn primary block" href="#/login">Till Hemkoll</a>'}</div>`;
    return;
  }
  const pics = (to) => sh.files.filter((f) => f.to === to);
  const docs = Object.fromEntries((sh.docs || []).map((d) => [d.key, d]));
  const thumbs = (list) => (list.length ? `<div class="thumbs">${list.map((f) => `<button type="button" data-img="${f.id}"><img class="photo" src="${f.data}" alt=""></button>`).join('')}</div>` : '');

  el.innerHTML = `<div class="screen no-nav">
    ${top}
    <header class="stack" style="gap:4px">
      <span class="muted small" style="font-weight:600">Husets historia</span>
      <h1>${esc(sh.house)}</h1>
      <span class="muted">${sh.fromName ? `Från ${esc(sh.fromName)} · ` : ''}${plural((sh.events || []).length, 'händelse', 'händelser')}</span>
    </header>
    <div class="banner soft">Spara i Hemkoll så har du bilder, kvitton och manualer för huset samlat.</div>
    <div data-cta></div>

    ${(sh.events || []).map((e) => {
      const [, label, ic] = kindInfo(e.kind);
      const link = safeUrl(e.link);
      const eDocs = (e.docKeys || []).map((k) => docs[k]).filter(Boolean);
      return `<section class="card stack-lg">
        <div class="row" style="gap:12px">${iconBox(ic)}
          <div class="stack grow" style="gap:2px"><b style="font-size:17px">${esc(e.title)}</b><span class="small muted">${esc(label)} · ${esc(fmtFull(e.date))}${e.cost ? ' · ' + kr(e.cost) : ''}</span></div>
        </div>
        ${e.note ? `<p style="white-space:pre-wrap">${esc(e.note)}</p>` : ''}
        ${thumbs(pics('e:' + e.key))}
        ${link ? `<a class="btn outline block" href="${esc(link)}" target="_blank" rel="noopener">${icon('book', 20)}Bruksanvisning</a>` : ''}
        ${eDocs.map((d) => `<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:12px">
          <span class="row" style="gap:8px"><span style="color:var(--accent)">${icon(catInfo(d.category)[2], 20)}</span><b>${esc(d.title)}</b></span>
          <span class="small muted">${esc([catInfo(d.category)[1], d.date ? fmtFull(d.date) : '', d.place || '', d.amount ? kr(d.amount) : '', d.warrantyUntil ? 'Garanti till ' + fmtFull(d.warrantyUntil) : ''].filter(Boolean).join(' · '))}</span>
          ${thumbs(pics('d:' + d.key))}
        </div>`).join('')}
      </section>`;
    }).join('')}
    <div data-cta></div>
  </div>`;

  const cta = loggedIn
    ? `<button class="btn primary block" data-import>${icon('plus', 20, 2.2)}Spara i min Hemkoll</button>`
    : `<div class="stack"><a class="btn primary block" href="#/registrera" data-pend>Skapa konto och spara</a>
        <a class="btn ghost" href="#/login" data-pend>Jag har redan ett konto</a></div>`;
  el.querySelectorAll('[data-cta]').forEach((c) => { c.innerHTML = cta; });

  el.querySelectorAll('[data-pend]').forEach((a) => a.addEventListener('click', () => {
    try { localStorage.setItem(PENDING_IMPORT, token); } catch { /* ok */ }
  }));
  el.querySelectorAll('[data-import]').forEach((b) => b.addEventListener('click', async () => {
    if (!ctx.state.profile) { ctx.go('/'); return; }
    const btns = [...el.querySelectorAll('[data-import]')];
    btns.forEach((x) => { x.disabled = true; x.textContent = 'Sparar… vänta lite'; });
    try {
      const sid = await importShare(sh, ctx.state.user.uid, ctx.state.profile.firstName);
      await ctx.reloadSpaces();
      toast('Sparat! Huset har en egen flik.');
      ctx.state.spaceId = sid;
      try { localStorage.setItem('hk-space', sid); } catch { /* ok */ }
      ctx.go('/tidslinje');
    } catch (ex) {
      toast(errorText(ex));
      btns.forEach((x) => { x.disabled = false; x.innerHTML = `${icon('plus', 20, 2.2)}Spara i min Hemkoll`; });
    }
  }));
  el.querySelectorAll('[data-img]').forEach((b) => b.addEventListener('click', () => {
    const f = sh.files.find((x) => x.id === b.dataset.img);
    openSheet(`<img src="${f.data}" alt="" style="width:100%;border-radius:12px"><button class="btn block" data-close>Stäng</button>`, 'Bild');
  }));
}
