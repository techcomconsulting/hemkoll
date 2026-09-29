// Inloggning, nytt konto och glömt lösenord.
import {
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail
} from '../firebase.js';
import { setupAccount } from '../data.js';
import { errorText, toast, busy, backLink } from '../ui.js';

const brand = `<div class="stack" style="align-items:flex-start;margin:12px 0 8px">
  <img src="icons/icon-192.png" alt="" width="56" height="56" style="border-radius:16px">
  <h1>Hemkoll</h1>
  <p class="muted">Kvitton, garantier och budget. På ett ställe.</p>
</div>`;

export async function loginView(el) {
  el.innerHTML = `<div class="screen no-nav">
    ${brand}
    <form class="card stack-lg" novalidate>
      <div class="field"><label for="em">E-post</label><input class="input" id="em" type="email" autocomplete="email" required></div>
      <div class="field"><label for="pw">Lösenord</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
      <p class="error hidden" role="alert"></p>
      <button class="btn primary block" type="submit">Logga in</button>
      <a class="btn ghost" href="#/glomt">Glömt lösenord?</a>
    </form>
    <a class="btn outline block" href="#/registrera">Skapa nytt konto</a>
  </div>`;
  const form = el.querySelector('form');
  const err = el.querySelector('.error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    await busy(form.querySelector('[type=submit]'), async () => {
      try { await signInWithEmailAndPassword(auth, form.em.value.trim(), form.pw.value); } catch (ex) { err.textContent = errorText(ex); err.classList.remove('hidden'); }
    });
  });
}

export async function registerView(el, ctx) {
  el.innerHTML = `<div class="screen no-nav">
    ${backLink('#/login', 'Logga in')}
    <h1>Skapa konto</h1>
    <form class="card stack-lg" novalidate>
      <div class="field"><label for="fn">Förnamn</label><input class="input" id="fn" autocomplete="given-name" required></div>
      <div class="field"><label for="em">E-post</label><input class="input" id="em" type="email" autocomplete="email" required>
        <span class="hint">Andra bjuder in dig med din e-post.</span></div>
      <div class="field"><label for="pw">Lösenord</label><input class="input" id="pw" type="password" autocomplete="new-password" required>
        <span class="hint">Minst 6 tecken.</span></div>
      <p class="error hidden" role="alert"></p>
      <button class="btn primary block" type="submit">Skapa konto</button>
    </form>
    <p class="small muted">Du får en egen privat flik. Gemensamma flikar kan du skapa sen.</p>
  </div>`;
  const form = el.querySelector('form');
  const err = el.querySelector('.error');
  const show = (t) => { err.textContent = t; err.classList.remove('hidden'); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    const firstName = form.fn.value.trim();
    if (!firstName) return show('Skriv ditt förnamn.');
    await busy(form.querySelector('[type=submit]'), async () => {
      try {
        ctx.state.registering = true;
        const cred = await createUserWithEmailAndPassword(auth, form.em.value.trim(), form.pw.value);
        await setupAccount(cred.user, firstName);
        ctx.state.registering = false;
        ctx.state.user = cred.user;
        await ctx.startSession(cred.user);
        ctx.go('/');
      } catch (ex) {
        ctx.state.registering = false;
        if (auth.currentUser) { ctx.state.user = auth.currentUser; await ctx.startSession(auth.currentUser); ctx.go('/'); return; }
        show(errorText(ex));
      }
    });
  });
}

export async function forgotView(el) {
  el.innerHTML = `<div class="screen no-nav">
    ${backLink('#/login', 'Logga in')}
    <h1>Glömt lösenord</h1>
    <form class="card stack-lg" novalidate>
      <div class="field"><label for="em">Din e-post</label><input class="input" id="em" type="email" autocomplete="email" required></div>
      <p class="error hidden" role="alert"></p>
      <button class="btn primary block" type="submit">Skicka länk</button>
    </form>
  </div>`;
  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await busy(form.querySelector('[type=submit]'), async () => {
      try { await sendPasswordResetEmail(auth, form.em.value.trim()); toast('Kolla din e-post.'); location.hash = '#/login'; } catch (ex) {
        const er = form.querySelector('.error'); er.textContent = errorText(ex); er.classList.remove('hidden');
      }
    });
  });
}

// Om kontot finns men uppgifterna saknas (t.ex. dåligt nät vid registrering).
export function finishAccountView(el, ctx) {
  el.innerHTML = `<div class="screen no-nav">
    <h1>Välkommen!</h1>
    <p class="muted">Vi behöver bara ditt förnamn.</p>
    <form class="card stack-lg" novalidate>
      <div class="field"><label for="fn">Förnamn</label><input class="input" id="fn" required></div>
      <button class="btn primary block" type="submit">Fortsätt</button>
    </form></div>`;
  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fn = form.fn.value.trim();
    if (!fn) return;
    await busy(form.querySelector('[type=submit]'), async () => {
      try { await setupAccount(ctx.state.user, fn); await ctx.startSession(ctx.state.user); ctx.go('/'); } catch (ex) { toast(errorText(ex)); }
    });
  });
}
