// Bjud in med länk. Fungerar även för den som inte har konto än.
import { createInviteLink, getInviteLink, joinWithLink, createSpace } from '../data.js';
import { esc, icon, openSheet, toast, busy, errorText } from '../ui.js';

export const PENDING_JOIN = 'hk-join';
const joinUrl = (token) => location.origin + location.pathname + '#/bjud/' + token;

async function sendInvite(token, spaceName, fromName) {
  const url = joinUrl(token);
  const text = `${fromName} bjuder in dig till "${spaceName}" i Hemkoll. Där har vi kvitton, garantier och budget på ett ställe.`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Inbjudan till Hemkoll', text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast('Länken är kopierad. Klistra in i sms eller mejl.'); return; } catch { /* visa den */ }
  const s = openSheet(`<h2>Inbjudningslänk</h2><input class="input" readonly value="${esc(url)}"><button class="btn block" data-close>Stäng</button>`, 'Länk');
  s.el.querySelector('input').select();
}

// Skapa länk för en gemensam flik och skicka den.
export async function inviteByLink(ctx, space, btn = null) {
  const go = async () => {
    try {
      const from = ctx.state.profile?.firstName || '';
      const token = await createInviteLink(space.id, space.name, from);
      await sendInvite(token, space.name, from);
    } catch (ex) { toast(errorText(ex)); }
  };
  if (btn) await busy(btn, go); else await go();
}

// Knappen "Bjud in någon" under Mer: välj flik, eller skapa en ny.
export function openInviteSheet(ctx) {
  const shared = ctx.state.spaces.filter((s) => !s.personal);
  const s = openSheet(`
    <h2>Bjud in någon</h2>
    <p class="muted">Ni delar pärm, budget och tidslinje i en gemensam flik. Din egen flik "Mitt" ser bara du.</p>
    ${shared.length ? `<div class="field"><label for="iv">Vilken flik?</label><select class="input" id="iv">
        ${shared.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}
        <option value="__new">+ Ny flik…</option></select></div>` : ''}
    <div class="field ${shared.length ? 'hidden' : ''}" data-newwrap><label for="ivn">Namn på ny flik</label>
      <input class="input" id="ivn" maxlength="30" value="Hushållet"></div>
    <p class="hint">Personen får en länk. Har hen inget konto skapar hen ett på en minut.</p>
    <div class="btn-row"><button class="btn" data-close>Avbryt</button><button class="btn primary" data-go>${icon('share', 18)}Skicka länk</button></div>`, 'Bjud in');
  const sel = s.el.querySelector('#iv');
  sel?.addEventListener('change', () => s.el.querySelector('[data-newwrap]').classList.toggle('hidden', sel.value !== '__new'));
  s.el.querySelector('[data-go]').addEventListener('click', async (e) => {
    await busy(e.currentTarget, async () => {
      try {
        let space = shared.find((x) => x.id === sel?.value);
        if (!space) {
          const name = s.el.querySelector('#ivn').value.trim() || 'Hushållet';
          const id = await createSpace(ctx.state.user.uid, ctx.state.profile.firstName, name);
          await ctx.reloadSpaces();
          space = { id, name };
        }
        s.close();
        await inviteByLink(ctx, space);
        ctx.rerender();
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}

// Sidan den inbjudna ser.
export async function joinView(el, ctx, token) {
  const inv = await getInviteLink(token).catch(() => null);
  const { state } = ctx;
  const brand = `<div class="row" style="gap:10px"><img src="icons/icon-192.png" alt="" width="40" height="40" style="border-radius:12px"><b style="font-size:18px">Hemkoll</b></div>`;
  if (!inv) {
    el.innerHTML = `<div class="screen no-nav">${brand}<div class="card empty">Inbjudan fungerar inte längre.<br>Be om en ny länk.</div>
      <a class="btn primary block" href="#/">Till Hemkoll</a></div>`;
    return;
  }
  const already = state.spaces.some((s) => s.id === inv.space);
  el.innerHTML = `<div class="screen no-nav">
    ${brand}
    <section class="card stack-lg" style="text-align:center;align-items:center;padding:28px 20px">
      <span style="width:64px;height:64px;border-radius:20px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center">${icon('users', 34)}</span>
      <h1 style="font-size:24px">${esc(inv.fromName || 'Någon')} bjuder in dig</h1>
      <p class="muted">till fliken <b>${esc(inv.spaceName)}</b>. Där delar ni kvitton, garantier, budget och husets historia.</p>
    </section>
    ${already ? `<a class="btn primary block" href="#/">Du är redan med – öppna</a>`
      : state.user ? `<button class="btn primary block" data-join>Gå med</button>`
        : `<a class="btn primary block" href="#/registrera" data-pend>Skapa konto och gå med</a>
           <a class="btn ghost" href="#/login" data-pend>Jag har redan ett konto</a>`}
  </div>`;

  el.querySelectorAll('[data-pend]').forEach((a) => a.addEventListener('click', () => {
    try { localStorage.setItem(PENDING_JOIN, token); } catch { /* ok */ }
  }));
  el.querySelector('[data-join]')?.addEventListener('click', async (e) => {
    if (!state.profile) { ctx.go('/'); return; }
    await busy(e.currentTarget, async () => {
      try {
        const sid = await joinWithLink(token, state.user.uid, state.profile.firstName);
        if (!sid) { toast('Inbjudan fungerar inte längre.'); return; }
        await ctx.reloadSpaces();
        toast(`Välkommen till ${inv.spaceName}!`);
        state.spaceId = sid;
        try { localStorage.setItem('hk-space', sid); } catch { /* ok */ }
        ctx.go('/');
      } catch (ex) { toast(errorText(ex)); }
    });
  });
}
