/*!
 * nepali-date — Bikram Sambat (BS) <-> Gregorian (AD) date converter.
 * Zero dependencies. Works in browsers (ES module) and Node.js >= 18.
 * Supported range: 2000-01-01 BS (1943-04-14 AD) to 2090-12-30 BS (2034-04-13 AD).
 * MIT License (c) 2026 Nabin
 */

/** First BS year in the table. */
export const MIN_BS_YEAR = 2000;
/** Last BS year in the table. */
export const MAX_BS_YEAR = 2090;

/**
 * Days in each BS month (Baishakh..Chaitra), one row per year from 2000 BS.
 * Cross-checked against four independent open-source tables; see DATA_SOURCES.md.
 */
const BS_MONTH_DAYS = [
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2000,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2001,
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2002,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2003,
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2004,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2005,
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2006,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2007,
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31], // 2008,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2009,
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2010,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2011,
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30], // 2012,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2013,
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2014,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2015,
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30], // 2016,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2017,
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2018,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2019,
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2020,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2021,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2022,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2023,
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2024,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2025,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2026,
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2027,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2028,
  [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30], // 2029,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2030,
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2031,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2032,
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2033,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2034,
  [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31], // 2035,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2036,
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2037,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2038,
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30], // 2039,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2040,
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2041,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2042,
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30], // 2043,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2044,
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2045,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2046,
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2047,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2048,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2049,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2050,
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2051,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2052,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2053,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2054,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2055,
  [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30], // 2056,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2057,
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2058,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2059,
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2060,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2061,
  [30, 32, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31], // 2062,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2063,
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2064,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2065,
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31], // 2066,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2067,
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2068,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2069,
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30], // 2070,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2071,
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2072,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2073,
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2074,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2075,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2076,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2077,
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2078,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2079,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2080,
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2081,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2082,
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2083,
  [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], // 2084,
  [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30], // 2085,
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2086,
  [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30], // 2087,
  [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30], // 2088,
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2089,
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2090
];

// 2000-01-01 BS == 1943-04-14 AD (UTC day number).
const EPOCH_AD_UTC = Date.UTC(1943, 3, 14);
const MS_PER_DAY = 86400000;

export const BS_MONTHS_EN = ['Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
export const BS_MONTHS_NE = ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत'];
export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_NE = ['आइतबार', 'सोमबार', 'मङ्गलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'];
const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

// Cumulative day offsets for each year start (index 0 = 2000 BS).
const YEAR_START = [0];
for (let i = 0; i < BS_MONTH_DAYS.length; i++) {
  YEAR_START.push(YEAR_START[i] + BS_MONTH_DAYS[i].reduce((a, b) => a + b, 0));
}
const TOTAL_DAYS = YEAR_START[YEAR_START.length - 1];

function assertInt(n, name) {
  if (!Number.isInteger(n)) throw new TypeError(`${name} must be an integer, got ${n}`);
}

/** Number of days in a BS month (month is 1-12). */
export function daysInBsMonth(year, month) {
  assertInt(year, 'year'); assertInt(month, 'month');
  if (year < MIN_BS_YEAR || year > MAX_BS_YEAR) {
    throw new RangeError(`BS year ${year} is outside the supported range ${MIN_BS_YEAR}-${MAX_BS_YEAR}`);
  }
  if (month < 1 || month > 12) throw new RangeError(`month must be 1-12, got ${month}`);
  return BS_MONTH_DAYS[year - MIN_BS_YEAR][month - 1];
}

/** Total days in a BS year. */
export function daysInBsYear(year) {
  daysInBsMonth(year, 1);
  return YEAR_START[year - MIN_BS_YEAR + 1] - YEAR_START[year - MIN_BS_YEAR];
}

/** True when year/month/day is a real BS date inside the supported range. */
export function isValidBs(year, month, day) {
  try {
    return Number.isInteger(day) && day >= 1 && day <= daysInBsMonth(year, month);
  } catch {
    return false;
  }
}

function toAdParts(input, month, day) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new TypeError('Invalid Date');
    // Use the calendar day as the user sees it (local time).
    return [input.getFullYear(), input.getMonth() + 1, input.getDate()];
  }
  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input.trim());
    if (!m) throw new TypeError(`Expected "YYYY-MM-DD", got "${input}"`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  return [input, month, day];
}

/**
 * Convert a Gregorian (AD) date to BS.
 * Accepts adToBs(Date) | adToBs('2026-11-01') | adToBs(2026, 11, 1).
 * @returns {{year:number, month:number, day:number, weekday:number}}
 */
export function adToBs(input, month, day) {
  const [y, m, d] = toAdParts(input, month, day);
  assertInt(y, 'year'); assertInt(m, 'month'); assertInt(d, 'day');
  const utc = Date.UTC(y, m - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d || y < 100) {
    throw new RangeError(`${y}-${m}-${d} is not a valid AD date`);
  }
  let offset = Math.round((utc - EPOCH_AD_UTC) / MS_PER_DAY);
  if (offset < 0 || offset >= TOTAL_DAYS) {
    throw new RangeError(`${y}-${m}-${d} AD is outside the supported range (1943-04-14 to 2034-04-13)`);
  }
  // Binary search the year.
  let lo = 0, hi = BS_MONTH_DAYS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (YEAR_START[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  offset -= YEAR_START[lo];
  const months = BS_MONTH_DAYS[lo];
  let mi = 0;
  while (offset >= months[mi]) { offset -= months[mi]; mi++; }
  return { year: MIN_BS_YEAR + lo, month: mi + 1, day: offset + 1, weekday: check.getUTCDay() };
}

/**
 * Convert a BS date to Gregorian (AD).
 * Accepts bsToAd(2083, 7, 15) | bsToAd('2083-07-15').
 * @returns {{year:number, month:number, day:number, weekday:number, date: Date}} date is UTC midnight.
 */
export function bsToAd(input, month, day) {
  let y = input, m = month, d = day;
  if (typeof input === 'string') {
    const r = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input.trim());
    if (!r) throw new TypeError(`Expected "YYYY-MM-DD", got "${input}"`);
    [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  }
  assertInt(y, 'year'); assertInt(m, 'month'); assertInt(d, 'day');
  const dim = daysInBsMonth(y, m);
  if (d < 1 || d > dim) throw new RangeError(`${BS_MONTHS_EN[m - 1]} ${y} has ${dim} days, got day ${d}`);
  const yi = y - MIN_BS_YEAR;
  let offset = YEAR_START[yi];
  for (let i = 0; i < m - 1; i++) offset += BS_MONTH_DAYS[yi][i];
  offset += d - 1;
  const date = new Date(EPOCH_AD_UTC + offset * MS_PER_DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: date.getUTCDay(), date };
}

/** Today's date in BS (uses the device's local calendar day). */
export function todayBs(now = new Date()) {
  return adToBs(now);
}

/** Convert ASCII digits in a value to Devanagari digits: 2083 -> २०८३ */
export function toNepaliDigits(value) {
  return String(value).replace(/[0-9]/g, (c) => NE_DIGITS[c]);
}

/** Convert Devanagari digits back to ASCII digits: २०८३ -> 2083 */
export function fromNepaliDigits(value) {
  return String(value).replace(/[०-९]/g, (c) => String(NE_DIGITS.indexOf(c)));
}

/**
 * Format a BS date.
 * Tokens: YYYY year, MM 2-digit month, M month, DD 2-digit day, D day,
 *         MMMM month name, dddd weekday name.
 * @param {{year:number,month:number,day:number}} bs
 * @param {string} [pattern='YYYY-MM-DD']
 * @param {'en'|'ne'} [lang='en'] 'ne' gives Nepali month/weekday names and Devanagari digits.
 */
export function formatBs(bs, pattern = 'YYYY-MM-DD', lang = 'en') {
  const { year, month, day } = bs;
  if (!isValidBs(year, month, day)) throw new RangeError('Invalid BS date');
  const weekday = bs.weekday ?? bsToAd(year, month, day).weekday;
  const ne = lang === 'ne';
  const pad = (n) => String(n).padStart(2, '0');
  const map = {
    YYYY: String(year),
    MMMM: (ne ? BS_MONTHS_NE : BS_MONTHS_EN)[month - 1],
    dddd: (ne ? WEEKDAYS_NE : WEEKDAYS_EN)[weekday],
    MM: pad(month), M: String(month), DD: pad(day), D: String(day),
  };
  const out = pattern.replace(/YYYY|MMMM|dddd|MM|M|DD|D/g, (t) => map[t]);
  return ne ? toNepaliDigits(out) : out;
}

export default {
  adToBs, bsToAd, todayBs, daysInBsMonth, daysInBsYear, isValidBs, formatBs,
  toNepaliDigits, fromNepaliDigits, BS_MONTHS_EN, BS_MONTHS_NE, WEEKDAYS_EN, WEEKDAYS_NE,
  MIN_BS_YEAR, MAX_BS_YEAR,
};
