// Mer: flikar, inbjudningar, konto.
import { auth, signOut } from '../firebase.js';
import {
  createSpace, renameSpace, inviteToSpace, cancelInvite, removeMember, deleteSpace, lookupEmail,
  acceptInvite, declineInvite, deleteAccount
} from '../data.js';
import { esc, icon, avatar, backLink, openSheet, confirmSheet, toast, busy, errorText } from '../ui.js';
import { isInstalled, showInstall } from '../install.js';
import { hasLoans } from './loans.js';

export async function moreView(el, ctx) {
  const { state } = ctx;
  await ctx.reloadSpaces().catch(() => {});
  const p = state.profile;
  el.innerHTML = `<div class="screen">
    <div class="row" style="gap:14px">${avatar(p.firstName, null, 56)}
      <div class="stack" style="gap:2px"><h1 style="font-size:26px">${esc(p.firstName)}</h1><span class="small muted">${esc(state.user.email)}</span></div></div>

    ${state.invites.map((s) => `<section class="card stack-lg">
      <b>${esc(s.memberNames?.[s.owner] || 'Någon')} bjuder in dig till fliken ${esc(s.name)}</b>
      <div class="btn-row"><button class="btn sm" data-decline="${s.id}">Nej tack</button><button class="btn primary sm" data-accept="${s.id}">Gå med</button></div>
    </section>`).join('')}

    <section class="stack"><h2>Mina flikar</h2>
      <div class="card flush">
        ${state.spaces.map((s) => `<a class="list-row" href="#/flik/${s.id}">
          <span style="width:40px;height:40px;border-radius:12px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center">${icon(s.personal ? 'lock' : 'users', 20)}</span>
          <span class="grow stack" style="gap:2px"><span class="title">${esc(s.name)}</span><span class="sub">${s.personal ? 'Bara du' : esc(Object.values(s.memberNames || {}).join(', '))}</span></span>
          ${icon('right', 18, 2)}</a>`).join('')}
      </div>
      <button class="btn outline block" data-new>${icon('plus', 20, 2.2)}Ny gemensam flik</button>
      <p class="small muted">En gemensam flik, t.ex. "Hushållet", delar ni. Alla med i fliken ser och kan ändra samma pärm och budget.</p>
    </section>

    <section class="card flush">
      <a class="list-row" href="#/tidslinje"><span style="color:var(--accent)">${icon('clock', 22)}</span><span class="grow title" style="font-weight:600">Husets tidslinje</span>${icon('right', 18, 2)}</a>
      ${hasLoans() ? `<a class="list-row" href="#/lan"><span style="color:var(--accent)">${icon('wallet', 22)}</span><span class="grow title" style="font-weight:600">Lån och krediter</span>${icon('right', 18, 2)}</a>` : ''}
    </section>

    <section class="card flush">
      ${isInstalled() ? '' : `<button class="list-row" data-home><img src="icons/icon-192.png" alt="" width="22" height="22" style="border-radius:6px"><span class="grow title" style="font-weight:600">Lägg till på hemskärmen</span>${icon('right', 18, 2)}</button>`}
      <button class="list-row" data-logout><span class="grow title" style="font-weight:600">Logga ut</span></button>
    </section>
    <button class="btn danger block" data-wipe>Radera mitt konto</button>
  </div>`;

  el.querySelector('[data-home]')?.addEventListener('click', showInstall);
  el.querySelector('[data-logout]').addEventListener('click', async () => { await signOut(auth); location.hash = '#/login'; });
  el.querySelector('[data-new]').addEventListener('click', () => {
    const s = openSheet(`
      <h2>Ny gemensam flik</h2>
      <div class="field"><label for="sn">Namn</label><input class="input" id="sn" maxlength="30" placeholder="t.ex. Hushållet"></div>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Skapa</button></div>`, 'Ny flik');
    s.el.querySelector('[data-save]').addEventListener('click', async (e) => {
      const name = s.el.querySelector('#sn').value.trim();
      if (!name) return;
      await busy(e.currentTarget, async () => {
        try {
          const id = await createSpace(state.user.uid, p.firstName, name);
          await ctx.reloadSpaces();
          s.close();
          state.spaceId = id;
          try { localStorage.setItem('hk-space', id); } catch { /* ok */ }
          ctx.go('/flik/' + id);
        } catch (ex) { toast(errorText(ex)); }
      });
    });
  });
  el.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', async () => {
    try { await acceptInvite(b.dataset.accept, state.user.uid, p.firstName); await ctx.reloadSpaces(); toast('Du är med!'); ctx.setSpace(b.dataset.accept); } catch (ex) { toast(errorText(ex)); }
  }));
  el.querySelectorAll('[data-decline]').forEach((b) => b.addEventListener('click', async () => {
    try { await declineInvite(b.dataset.decline, state.user.uid); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
  }));
  el.querySelector('[data-wipe]').addEventListener('click', () => {
    const s = openSheet(`
      <h2>Radera ditt konto?</h2>
      <p class="muted">Din egen flik raderas. Du lämnar gemensamma flikar, men det ni sparat där finns kvar för de andra. Det går inte att ångra.</p>
      <div class="field"><label for="pw">Skriv ditt lösenord</label><input class="input" id="pw" type="password" autocomplete="current-password"></div>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn danger-outline" data-go>Radera</button></div>`, 'Radera');
    s.el.querySelector('[data-go]').addEventListener('click', async (e) => {
      const pw = s.el.querySelector('#pw').value;
      if (!pw) return;
      await busy(e.currentTarget, async () => {
        try { await deleteAccount(pw); s.close(); toast('Kontot är raderat.'); location.hash = '#/login'; } catch (ex) { toast(errorText(ex)); }
      });
    });
  });
}

export async function spaceView(el, ctx, sid) {
  const { state } = ctx;
  await ctx.reloadSpaces().catch(() => {});
  const s = state.spaces.find((x) => x.id === sid);
  if (!s) { ctx.go('/mer'); return; }
  const me = state.user.uid;
  const isOwner = s.owner === me;
  const members = Object.entries(s.memberNames || {});
  const invited = Object.entries(s.invitedNames || {}).filter(([u]) => (s.invited || []).includes(u));

  el.innerHTML = `<div class="screen">
    ${backLink('#/mer', 'Mer')}
    <div class="between"><h1>${esc(s.name)}</h1><button class="btn outline sm" data-rename>${icon('edit', 16)}Byt namn</button></div>
    ${s.personal ? `<div class="banner soft row">${icon('lock', 22)}<span style="font-size:14px">Den här fliken är bara din. Ingen annan kan se den.</span></div>` : `
      <section class="stack"><h2>Med i fliken</h2><div class="card flush">
        ${members.map(([u, n]) => `<div class="list-row">${avatar(n, null, 36)}<span class="grow title">${esc(n)}${u === me ? ' (du)' : ''}</span>
          ${u === s.owner ? '<span class="chip neutral" style="font-size:12px">Skapade fliken</span>' : ''}
          ${isOwner && u !== me ? `<button class="btn sm" data-kick="${u}">Ta bort</button>` : ''}</div>`).join('')}
        ${invited.map(([u, n]) => `<div class="list-row">${avatar(n, null, 36)}<span class="grow stack" style="gap:2px"><span class="title">${esc(n)}</span><span class="sub">Inbjuden, väntar på svar</span></span><button class="btn sm" data-uninvite="${u}">Avbryt</button></div>`).join('')}
      </div></section>
      <form class="stack" data-invite novalidate>
        <label for="ie" style="font-size:14px;font-weight:600">Bjud in med e-post</label>
        <div class="row" style="gap:8px"><input class="input grow" id="ie" type="email" autocapitalize="none" placeholder="namn@exempel.se"><button class="btn primary" type="submit" style="height:50px">Bjud in</button></div>
        <span class="hint">Personen behöver ha ett konto i Hemkoll.</span>
      </form>
      ${isOwner ? '<button class="btn danger-outline block" data-delete>Ta bort fliken</button>' : '<button class="btn danger-outline block" data-leave>Lämna fliken</button>'}`}
  </div>`;

  el.querySelector('[data-rename]').addEventListener('click', () => {
    const sh = openSheet(`<h2>Byt namn</h2>
      <div class="field"><label for="nn">Namn</label><input class="input" id="nn" maxlength="30" value="${esc(s.name)}"></div>
      <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-save>Spara</button></div>`, 'Byt namn');
    sh.el.querySelector('[data-save]').addEventListener('click', async () => {
      const n = sh.el.querySelector('#nn').value.trim();
      if (!n) return;
      try { await renameSpace(sid, n); await ctx.reloadSpaces(); sh.close(); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
    });
  });
  el.querySelector('[data-invite]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = el.querySelector('#ie').value.trim();
    if (!email) return;
    await busy(e.target.querySelector('[type=submit]'), async () => {
      try {
        const person = await lookupEmail(email);
        if (!person) return toast('Hittade ingen med den e-posten. Be personen skapa ett konto först.');
        if (person.uid === me) return toast('Det där är du själv.');
        if ((s.members || []).includes(person.uid)) return toast(`${person.firstName} är redan med.`);
        await inviteToSpace(sid, person);
        toast(`${person.firstName} är inbjuden.`);
        ctx.rerender();
      } catch (ex) { toast(errorText(ex)); }
    });
  });
  el.querySelectorAll('[data-uninvite]').forEach((b) => b.addEventListener('click', async () => {
    try { await cancelInvite(sid, b.dataset.uninvite); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
  }));
  el.querySelectorAll('[data-kick]').forEach((b) => b.addEventListener('click', async () => {
    const name = s.memberNames[b.dataset.kick];
    if (!(await confirmSheet({ title: `Ta bort ${name} från fliken?`, ok: 'Ta bort', danger: true }))) return;
    try { await removeMember(sid, b.dataset.kick); ctx.rerender(); } catch (ex) { toast(errorText(ex)); }
  }));
  el.querySelector('[data-leave]')?.addEventListener('click', async () => {
    if (!(await confirmSheet({ title: `Lämna ${s.name}?`, text: 'Du ser inte fliken längre. Det som sparats finns kvar för de andra.', ok: 'Lämna', danger: true }))) return;
    try { await removeMember(sid, me); await ctx.reloadSpaces(); ctx.go('/mer'); } catch (ex) { toast(errorText(ex)); }
  });
  el.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!(await confirmSheet({ title: `Ta bort ${s.name}?`, text: 'Allt i fliken raderas för alla: pärm, påminnelser och budget.', ok: 'Ta bort allt', danger: true }))) return;
    try { await deleteSpace(sid); await ctx.reloadSpaces(); toast('Fliken är borttagen.'); ctx.go('/mer'); } catch (ex) { toast(errorText(ex)); }
  });
}
