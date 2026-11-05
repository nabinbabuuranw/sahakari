import { formatNpr as fmt } from '../../shared/money.ts';
// @ts-ignore plain ES module
import { adToBs, formatBs, BS_MONTHS_EN } from '../../shared/nepali-date.js';

export const rs = (paisa: number) => fmt(paisa);
/** Rupees typed in a form to paisa, with the same rules as the Worker. */
export function rupeesToNumber(s: string): number | null {
  const t = s.replace(/[,\s]/g, '').replace(/^Rs\.?/i, '');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100) / 100;
}

/** Bikram Sambat date text for an ISO (AD) date: "20 Kartik 2083". */
export function bsText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const bs = adToBs(new Date(Date.UTC(y, m - 1, d)));
  return `${bs.day} ${BS_MONTHS_EN[bs.month - 1]} ${bs.year}`;
}
export function bsShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return formatBs(adToBs(new Date(Date.UTC(y, m - 1, d))), 'YYYY-MM-DD');
}
export function adText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
export const today = () => new Date(Date.now() + (5 * 60 + 45) * 60000).toISOString().slice(0, 10);
export const addMonths = (iso: string, k: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + k;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};
export const pct = (bp: number) => `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
