// Knappen "Lägg till" i menyn.
import { openSheet, icon } from '../ui.js';
import { openDocEditor } from './binder.js';
import { openReminderEditor } from './reminders.js';
import { openItemEditor } from './budget.js';
import { openEventEditor } from './timeline.js';

export function openAddMenu(ctx) {
  const opt = (key, ic, title, sub) => `<button class="list-row" data-pick="${key}" style="border-radius:0">
    <span style="width:44px;height:44px;border-radius:14px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center">${icon(ic, 24)}</span>
    <span class="grow stack" style="gap:2px"><span class="title">${title}</span><span class="sub">${sub}</span></span></button>`;
  const s = openSheet(`
    <h2>Lägg till</h2>
    <div class="card flush" style="box-shadow:none;border:1px solid var(--line)">
      ${opt('receipt', 'receipt', 'Kvitto', 'Fota kvittot och spara')}
      ${opt('warranty', 'shield', 'Garanti eller försäkring', 'Få påminnelse innan den går ut')}
      ${opt('manual', 'book', 'Bruksanvisning eller avtal', 'Allt samlat i pärmen')}
      ${opt('event', 'clock', 'Händelse i tidslinjen', 'Renovering, nytt köp, service')}
      ${opt('reminder', 'bell', 'Påminnelse', 't.ex. byt filter varje halvår')}
      ${opt('expense', 'wallet', 'Utgift eller räkning', 'Hyra, el, abonnemang')}
      ${opt('income', 'plus', 'Inkomst', 'Lön, barnbidrag')}
    </div>
    <button class="btn block" data-close>Stäng</button>`, 'Lägg till');
  s.el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.pick;
    s.close();
    if (['receipt', 'warranty', 'manual'].includes(k)) openDocEditor(ctx, null, k);
    else if (k === 'event') openEventEditor(ctx);
    else if (k === 'reminder') openReminderEditor(ctx);
    else openItemEditor(ctx, k);
  }));
}
