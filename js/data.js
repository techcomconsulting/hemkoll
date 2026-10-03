// All kontakt med databasen samlad på ett ställe.
import {
  db, auth, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where,
  orderBy, writeBatch, serverTimestamp, Timestamp, getDocsFromServer, arrayUnion, arrayRemove, deleteField,
  deleteUser, reauthenticateWithCredential, EmailAuthProvider
} from './firebase.js';

// ---------- Snabb läsning ----------
// 1. Minne för sessionen. 2. Sparad kopia i telefonen (små listor) så att appen
// visar något direkt när den startar. Nytt hämtas alltid i bakgrunden.
const mem = new Map();
const LS = 'hk-cache:';
let gen = 0;
let onChange = () => {};
export function onDataChange(fn) { onChange = fn; }
const uidKey = (key) => (auth.currentUser?.uid || '') + ':' + key;
function lsGet(k) { try { return JSON.parse(localStorage.getItem(LS + k)); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch { /* fullt */ } }
export function invalidate(...parts) {
  gen++;
  const hit = (k) => !parts.length || parts.some((p) => k.includes(p));
  for (const k of [...mem.keys()]) if (hit(k)) mem.delete(k);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS) && hit(k.slice(LS.length))) localStorage.removeItem(k);
    }
  } catch { /* ok */ }
}
function same(a, b) { try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; } }
function refreshRows(q, k, persist, force = false) {
  const hit = mem.get(k);
  if (!force && hit && Date.now() - hit.t < 15000) return;
  if (hit) hit.t = Date.now();
  const g = gen;
  getDocsFromServer(q).then((s) => {
    if (g !== gen) return;
    const r = rows(s);
    const changed = !same(r, mem.get(k)?.rows);
    mem.set(k, { rows: r, t: Date.now() });
    if (persist) lsSet(k, r);
    if (changed) onChange();
  }).catch(() => {});
}
async function fastRows(q, key, persist = true) {
  const k = uidKey(key);
  if (mem.has(k)) { refreshRows(q, k, persist); return mem.get(k).rows; }
  if (persist) {
    const c = lsGet(k);
    if (c) { mem.set(k, { rows: c, t: 0 }); refreshRows(q, k, persist, true); return c; }
  }
  const g = gen;
  const r = rows(await getDocs(q));
  if (g === gen) { mem.set(k, { rows: r, t: Date.now() }); if (persist) lsSet(k, r); }
  return r;
}
const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));

// ---------- Konto ----------

export async function getProfile(uid, fast = false) {
  const k = 'profile:' + uid;
  const load = async () => {
    const s = await getDoc(doc(db, 'users', uid));
    const v = s.exists() ? s.data() : null;
    if (v) lsSet(k, { firstName: v.firstName, email: v.email, personalSpace: v.personalSpace || null });
    return v;
  };
  if (fast) { const c = lsGet(k); if (c) { load().catch(() => {}); return c; } }
  return load();
}

export async function setupAccount(user, firstName) {
  const b = writeBatch(db);
  const sref = doc(collection(db, 'spaces'));
  b.set(doc(db, 'users', user.uid), { firstName, email: user.email, personalSpace: sref.id, createdAt: serverTimestamp() });
  b.set(doc(db, 'emails', user.email.toLowerCase()), { uid: user.uid, firstName });
  b.set(sref, {
    name: 'Mitt', owner: user.uid, personal: true, members: [user.uid],
    memberNames: { [user.uid]: firstName }, invited: [], invitedNames: {}, createdAt: serverTimestamp()
  });
  await b.commit();
}

export async function saveProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

export async function lookupEmail(email) {
  const s = await getDoc(doc(db, 'emails', String(email).trim().toLowerCase()));
  return s.exists() ? s.data() : null;
}

// ---------- Flikar (hushåll) ----------

export async function loadSpaces(uid) {
  const r = await fastRows(query(collection(db, 'spaces'), where('members', 'array-contains', uid)), 'spaces');
  return [...r].sort((a, b) => (b.personal ? 1 : 0) - (a.personal ? 1 : 0) || a.name.localeCompare(b.name, 'sv'));
}

export async function loadInvites(uid) {
  try {
    const s = await getDocs(query(collection(db, 'spaces'), where('invited', 'array-contains', uid)));
    return rows(s);
  } catch { return []; }
}

export async function createSpace(uid, firstName, name) {
  invalidate('spaces');
  const ref = await addDoc(collection(db, 'spaces'), {
    name, owner: uid, personal: false, members: [uid],
    memberNames: { [uid]: firstName }, invited: [], invitedNames: {}, createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function renameSpace(sid, name) {
  invalidate('spaces');
  await updateDoc(doc(db, 'spaces', sid), { name });
}

export async function inviteToSpace(sid, person) {
  invalidate('spaces');
  await updateDoc(doc(db, 'spaces', sid), { invited: arrayUnion(person.uid), [`invitedNames.${person.uid}`]: person.firstName });
}

export async function cancelInvite(sid, uid) {
  invalidate('spaces');
  await updateDoc(doc(db, 'spaces', sid), { invited: arrayRemove(uid), [`invitedNames.${uid}`]: deleteField() });
}

export async function acceptInvite(sid, uid, firstName) {
  invalidate('spaces');
  await updateDoc(doc(db, 'spaces', sid), {
    members: arrayUnion(uid), invited: arrayRemove(uid), [`memberNames.${uid}`]: firstName
  });
}

export async function declineInvite(sid, uid) {
  invalidate('spaces');
  await updateDoc(doc(db, 'spaces', sid), { invited: arrayRemove(uid) });
}

export async function removeMember(sid, uid) {
  invalidate('spaces');
  await updateDoc(doc(db, 'spaces', sid), { members: arrayRemove(uid), [`memberNames.${uid}`]: deleteField() });
}

async function deleteCollectionDocs(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
}

export async function deleteSpace(sid) {
  invalidate();
  const refs = [];
  const docsSnap = await getDocs(collection(db, 'spaces', sid, 'docs'));
  for (const d of docsSnap.docs) {
    (await getDocs(collection(d.ref, 'files'))).forEach((f) => refs.push(f.ref));
    refs.push(d.ref);
  }
  const evSnap = await getDocs(collection(db, 'spaces', sid, 'events'));
  for (const e of evSnap.docs) {
    (await getDocs(collection(e.ref, 'files'))).forEach((f) => refs.push(f.ref));
    refs.push(e.ref);
  }
  for (const name of ['reminders', 'items', 'paid']) {
    (await getDocs(collection(db, 'spaces', sid, name))).forEach((d) => refs.push(d.ref));
  }
  await deleteCollectionDocs(refs);
  await deleteDoc(doc(db, 'spaces', sid));
}

// ---------- Pärmen ----------

export const DOC_CATS = [
  ['receipt', 'Kvitto', 'receipt'],
  ['warranty', 'Garanti', 'shield'],
  ['insurance', 'Försäkring', 'shield'],
  ['manual', 'Bruksanvisning', 'book'],
  ['contract', 'Avtal', 'doc'],
  ['other', 'Övrigt', 'tag']
];

export async function loadDocs(sid) {
  const r = await fastRows(query(collection(db, 'spaces', sid, 'docs')), 'docs:' + sid);
  return [...r].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export async function getDocument(sid, id) {
  const s = await getDoc(doc(db, 'spaces', sid, 'docs', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function saveDocument(sid, data, id = null) {
  invalidate('docs:' + sid);
  if (id) { await updateDoc(doc(db, 'spaces', sid, 'docs', id), { ...data, updatedAt: serverTimestamp() }); return id; }
  const ref = await addDoc(collection(db, 'spaces', sid, 'docs'), { ...data, fileCount: 0, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid });
  return ref.id;
}

export async function deleteDocument(sid, id) {
  invalidate('docs:' + sid, 'files:' + id);
  const files = await getDocs(collection(db, 'spaces', sid, 'docs', id, 'files'));
  const b = writeBatch(db);
  files.forEach((f) => b.delete(f.ref));
  b.delete(doc(db, 'spaces', sid, 'docs', id));
  await b.commit();
}

export async function loadFiles(sid, id) {
  return fastRows(query(collection(db, 'spaces', sid, 'docs', id, 'files'), orderBy('at')), 'files:' + id, false);
}

export async function addFile(sid, id, data, count) {
  invalidate('files:' + id, 'docs:' + sid);
  const b = writeBatch(db);
  b.set(doc(collection(db, 'spaces', sid, 'docs', id, 'files')), { data, at: Timestamp.now() });
  b.update(doc(db, 'spaces', sid, 'docs', id), { fileCount: count + 1 });
  await b.commit();
}

export async function deleteFile(sid, id, fileId, count) {
  invalidate('files:' + id, 'docs:' + sid);
  const b = writeBatch(db);
  b.delete(doc(db, 'spaces', sid, 'docs', id, 'files', fileId));
  b.update(doc(db, 'spaces', sid, 'docs', id), { fileCount: Math.max(0, count - 1) });
  await b.commit();
}

// ---------- Påminnelser ----------

export async function loadReminders(sid) {
  const r = await fastRows(query(collection(db, 'spaces', sid, 'reminders')), 'reminders:' + sid);
  return [...r].sort((a, b) => String(a.next || '').localeCompare(String(b.next || '')));
}

export async function saveReminder(sid, data, id = null) {
  invalidate('reminders:' + sid);
  if (id) await updateDoc(doc(db, 'spaces', sid, 'reminders', id), data);
  else await addDoc(collection(db, 'spaces', sid, 'reminders'), { ...data, createdAt: serverTimestamp() });
}

export async function deleteReminder(sid, id) {
  invalidate('reminders:' + sid);
  await deleteDoc(doc(db, 'spaces', sid, 'reminders', id));
}

// ---------- Budget ----------

export const EXPENSE_CATS = ['Boende', 'Mat', 'Transport', 'Försäkring', 'Abonnemang', 'Barn', 'Lån', 'Nöje', 'Sparande', 'Övrigt'];
export const INCOME_CATS = ['Lön', 'Barnbidrag', 'Övrigt'];
export const FREQS = [['monthly', 'Varje månad'], ['quarterly', 'Var tredje månad'], ['yearly', 'En gång per år'], ['once', 'Bara en gång']];

export function occursIn(item, y, m) {
  if (item.freq === 'monthly') return true;
  if (item.freq === 'quarterly') return ((m - (item.month || 1)) % 3 + 3) % 3 === 0;
  if (item.freq === 'yearly') return m === (item.month || 1);
  if (item.freq === 'once') return y === item.year && m === item.month;
  return false;
}

export async function loadItems(sid) {
  return fastRows(query(collection(db, 'spaces', sid, 'items')), 'items:' + sid);
}

export async function saveItem(sid, data, id = null) {
  invalidate('items:' + sid);
  if (id) await setDoc(doc(db, 'spaces', sid, 'items', id), data);
  else await addDoc(collection(db, 'spaces', sid, 'items'), data);
}

export async function deleteItem(sid, id) {
  invalidate('items:' + sid);
  await deleteDoc(doc(db, 'spaces', sid, 'items', id));
}

export async function loadPaid(sid, ym) {
  const k = uidKey('paid:' + sid + ':' + ym);
  const load = async () => {
    const s = await getDoc(doc(db, 'spaces', sid, 'paid', ym));
    const v = s.exists() ? s.data() : {};
    const old = mem.get(k)?.s;
    mem.set(k, { s: v, t: Date.now() });
    lsSet(k, v);
    if (old && !same(old, v)) onChange();
    return v;
  };
  if (mem.has(k)) { const hit = mem.get(k); if (Date.now() - hit.t > 15000) { hit.t = Date.now(); load().catch(() => {}); } return hit.s; }
  const c = lsGet(k);
  if (c) { mem.set(k, { s: c, t: 0 }); load().catch(() => {}); return c; }
  return load();
}

export async function setPaid(sid, ym, itemId, paid) {
  const k = uidKey('paid:' + sid + ':' + ym);
  const cur = mem.get(k)?.s || {};
  if (paid) cur[itemId] = true; else delete cur[itemId];
  mem.set(k, { s: cur, t: Date.now() });
  lsSet(k, cur);
  await setDoc(doc(db, 'spaces', sid, 'paid', ym), { [itemId]: paid ? true : deleteField() }, { merge: true });
}

export const ymKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

// ---------- Tidslinjen (husets historia) ----------

export const EVENT_KINDS = [
  ['renovation', 'Renovering', 'hammer'],
  ['purchase', 'Nytt köp', 'tag'],
  ['repair', 'Reparation', 'tool'],
  ['service', 'Service', 'repeat'],
  ['other', 'Övrigt', 'flag']
];

export async function loadEvents(sid) {
  const r = await fastRows(query(collection(db, 'spaces', sid, 'events')), 'events:' + sid);
  return [...r].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export async function getEvent(sid, id) {
  const s = await getDoc(doc(db, 'spaces', sid, 'events', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function saveEvent(sid, data, id = null) {
  invalidate('events:' + sid);
  if (id) { await updateDoc(doc(db, 'spaces', sid, 'events', id), { ...data, updatedAt: serverTimestamp() }); return id; }
  const ref = await addDoc(collection(db, 'spaces', sid, 'events'), {
    docIds: [], ...data, fileCount: 0, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid
  });
  return ref.id;
}

export async function deleteEvent(sid, id) {
  invalidate('events:' + sid, 'efiles:' + id);
  const files = await getDocs(collection(db, 'spaces', sid, 'events', id, 'files'));
  const b = writeBatch(db);
  files.forEach((f) => b.delete(f.ref));
  b.delete(doc(db, 'spaces', sid, 'events', id));
  await b.commit();
}

export async function loadEventFiles(sid, id) {
  return fastRows(query(collection(db, 'spaces', sid, 'events', id, 'files'), orderBy('at')), 'efiles:' + id, false);
}

export async function addEventFile(sid, id, data, count) {
  invalidate('efiles:' + id, 'events:' + sid);
  const b = writeBatch(db);
  b.set(doc(collection(db, 'spaces', sid, 'events', id, 'files')), { data, at: Timestamp.now() });
  b.update(doc(db, 'spaces', sid, 'events', id), { fileCount: count + 1 });
  await b.commit();
}

export async function deleteEventFile(sid, id, fileId, count) {
  invalidate('efiles:' + id, 'events:' + sid);
  const b = writeBatch(db);
  b.delete(doc(db, 'spaces', sid, 'events', id, 'files', fileId));
  b.update(doc(db, 'spaces', sid, 'events', id), { fileCount: Math.max(0, count - 1) });
  await b.commit();
}

export async function setEventDocs(sid, id, docIds) {
  invalidate('events:' + sid);
  await updateDoc(doc(db, 'spaces', sid, 'events', id), { docIds });
}

// ---------- Dela husets logg med en ny ägare ----------
// En kopia sparas under en hemlig länk. Den som har länken kan se den
// och spara den i sin egen Hemkoll.

function newToken() {
  const abc = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(24));
  return [...r].map((n) => abc[n % abc.length]).join('');
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] != null && o[k] !== '').map((k) => [k, o[k]]));

export async function createShare(sid, { house, fromName, eventIds, withAmounts }) {
  const uid = auth.currentUser.uid;
  const events = (await loadEvents(sid)).filter((e) => eventIds.includes(e.id));
  const allDocs = await loadDocs(sid);
  const docIds = [...new Set(events.flatMap((e) => e.docIds || []))].filter((id) => allDocs.some((d) => d.id === id));
  const docs = allDocs.filter((d) => docIds.includes(d.id));
  const money = withAmounts ? ['cost', 'amount'] : [];

  const token = newToken();
  await setDoc(doc(db, 'shares', token), {
    owner: uid, space: sid, house, fromName, createdAt: serverTimestamp(),
    events: events.map((e) => ({
      key: e.id, ...pick(e, ['title', 'date', 'kind', 'note', 'link', ...money]),
      docKeys: (e.docIds || []).filter((id) => docIds.includes(id))
    })),
    docs: docs.map((d) => ({ key: d.id, ...pick(d, ['title', 'category', 'date', 'place', 'warrantyUntil', 'note', ...money]) }))
  });

  // Bilderna, en i taget (de är stora).
  let i = 0;
  for (const e of events) {
    for (const f of await loadEventFiles(sid, e.id)) await setDoc(doc(collection(db, 'shares', token, 'files')), { to: 'e:' + e.id, data: f.data, i: i++ });
  }
  for (const d of docs) {
    for (const f of await loadFiles(sid, d.id)) await setDoc(doc(collection(db, 'shares', token, 'files')), { to: 'd:' + d.id, data: f.data, i: i++ });
  }
  invalidate('shares:');
  return token;
}

export async function loadMyShares(sid) {
  const uid = auth.currentUser.uid;
  const r = await fastRows(query(collection(db, 'shares'), where('owner', '==', uid), where('space', '==', sid)), 'shares:' + sid);
  return [...r].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function deleteShare(token) {
  invalidate('shares:');
  const files = await getDocs(collection(db, 'shares', token, 'files'));
  await deleteCollectionDocs(files.docs.map((f) => f.ref));
  await deleteDoc(doc(db, 'shares', token));
}

export async function getShare(token) {
  const s = await getDoc(doc(db, 'shares', token));
  if (!s.exists()) return null;
  const files = await getDocs(collection(db, 'shares', token, 'files'));
  return { id: s.id, ...s.data(), files: rows(files).sort((a, b) => a.i - b.i) };
}

// Köparen sparar loggen i en ny flik i sin egen app.
export async function importShare(share, uid, firstName) {
  const sid = await createSpace(uid, firstName, (share.house || 'Huset').slice(0, 30));
  const filesFor = (to) => share.files.filter((f) => f.to === to);
  const docMap = {};
  for (const d of share.docs || []) {
    const { key, ...data } = d;
    const id = await saveDocument(sid, { title: '', category: 'other', ...data });
    let n = 0;
    for (const f of filesFor('d:' + key)) await addFile(sid, id, f.data, n++);
    docMap[key] = id;
  }
  for (const e of share.events || []) {
    const { key, docKeys, ...data } = e;
    const id = await saveEvent(sid, { title: '', kind: 'other', ...data, docIds: (docKeys || []).map((k) => docMap[k]).filter(Boolean) });
    let n = 0;
    for (const f of filesFor('e:' + key)) await addEventFile(sid, id, f.data, n++);
  }
  return sid;
}

// ---------- Radera kontot ----------

export async function deleteAccount(password, personalSpaceId) {
  const user = auth.currentUser;
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const spaces = await loadSpaces(user.uid);
  for (const s of spaces) {
    if (s.owner === user.uid && (s.personal || s.members.length === 1)) await deleteSpace(s.id);
    else await removeMember(s.id, user.uid);
  }
  const shares = await getDocs(query(collection(db, 'shares'), where('owner', '==', user.uid))).catch(() => null);
  for (const sh of shares?.docs || []) await deleteShare(sh.id).catch(() => {});
  const invites = await loadInvites(user.uid);
  for (const s of invites) await declineInvite(s.id, user.uid).catch(() => {});
  await deleteDoc(doc(db, 'emails', user.email.toLowerCase())).catch(() => {});
  await deleteDoc(doc(db, 'users', user.uid));
  await deleteUser(user);
}

export function prefetch(uid, sid) {
  if (!sid) return;
  [() => loadDocs(sid), () => loadReminders(sid), () => loadItems(sid), () => loadEvents(sid)].forEach((j) => j().catch(() => {}));
}

export { Timestamp };
