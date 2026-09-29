// Datum som text: 'ÅÅÅÅ-MM-DD'.
import { isoDay, dShort, dFull } from './ui.js';

export const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
export const today = () => isoDay(new Date());
export const asDate = (iso) => new Date(iso + 'T12:00:00');
export const fmtShort = (iso) => (iso ? dShort(asDate(iso)) : '');
export const fmtFull = (iso) => (iso ? dFull(asDate(iso)) : '');

export function addMonths(iso, n) {
  const d = asDate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return isoDay(d);
}

export function daysUntil(iso) {
  const a = asDate(today()), b = asDate(iso);
  return Math.round((b - a) / 86400000);
}

export function whenText(iso) {
  const n = daysUntil(iso);
  if (n < -1) return `${-n} dagar sedan`;
  if (n === -1) return 'Igår';
  if (n === 0) return 'Idag';
  if (n === 1) return 'Imorgon';
  if (n < 14) return `Om ${n} dagar`;
  return fmtShort(iso);
}

// Datum för en post i en viss månad (dagen justeras för korta månader).
export function dayInMonth(y, m, day) {
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day || 1, last)).padStart(2, '0')}`;
}
