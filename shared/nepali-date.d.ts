export interface BsDate { year: number; month: number; day: number; weekday: number }
export const MIN_BS_YEAR: number; export const MAX_BS_YEAR: number;
export const BS_MONTHS_EN: string[]; export const BS_MONTHS_NE: string[];
export function daysInBsMonth(year: number, month: number): number;
export function isValidBs(year: number, month: number, day: number): boolean;
export function adToBs(input: Date | string | number, month?: number, day?: number): BsDate;
export function bsToAd(input: string | number, month?: number, day?: number): BsDate & { date: Date };
export function toNepaliDigits(value: string | number): string;
export function formatBs(bs: { year: number; month: number; day: number; weekday?: number }, pattern?: string, lang?: 'en' | 'ne'): string;
