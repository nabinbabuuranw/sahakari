// Thin client for the Worker API. Errors become plain sentences; the codes stay in the console only.
export class ApiError extends Error {
  status: number;
  code: string;
  data: Record<string, any>;
  constructor(status: number, code: string, data: Record<string, any>) {
    super(messageFor(code, data));
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const FIELD: Record<string, string> = {
  full_name: 'Full name', phone: 'Phone number', address: 'Address', nominee_name: 'Nominee name', nominee_relation: 'Nominee relation',
  amount: 'Amount', principal: 'Loan amount', date: 'Date', joined_ad: 'Joining date', disbursed_ad: 'Disbursal date', first_due_ad: 'First installment date',
  paid_ad: 'Payment date', note: 'Note', purpose: 'Purpose', email: 'Email', password: 'Password', next: 'New password', name: 'Name',
  member_code: 'Member code', term_months: 'Term in months', months: 'Months', method: 'Method', annual_rate_pct: 'Interest rate',
  savings_rate_pct: 'Savings interest rate', loan_rate_pct: 'Loan interest rate', loan_multiplier: 'Loan limit multiplier', reg_no: 'Registration number',
  from: 'From date', to: 'To date', status: 'Status', kind: 'Entry type', member_id: 'Member',
};

export function messageFor(code: string, d: Record<string, any> = {}): string {
  const f = d.field ? (FIELD[d.field] ?? d.field) : '';
  switch (code) {
    case 'sign_in_required': return 'Please sign in again.';
    case 'office_only': return 'Only the cooperative office can do that.';
    case 'not_yours': return 'That record is not on your account.';
    case 'wrong_credentials': return 'Email or password is not right.';
    case 'too_many_attempts': return 'Too many tries from here. Wait a few minutes and try again.';
    case 'email_taken': return 'Another account already uses this email.';
    case 'code_not_usable': return 'That member code is not valid, or it has already been used to make an account. Ask the office for a new one.';
    case 'wrong_current_password': return 'The current password is not right.';
    case 'insufficient_balance': return `That withdrawal is more than the balance. Balance now: ${d.balance !== undefined ? rs(d.balance) : 'see the ledger'}.`;
    case 'exceeds_limit': return `A loan can be up to ${rs(d.limit)} for this member (savings balance times ${d.multiplier}).`;
    case 'active_loan_exists': return 'This member already has an active loan. Close it before issuing another.';
    case 'over_due': return `That payment is more than what is due. Amount due now: ${rs(d.amount_due)}.`;
    case 'loan_closed': return 'This loan is already closed.';
    case 'member_inactive': return 'This member is inactive. Mark them active before recording entries.';
    case 'nothing_to_credit': return 'There is no balance to earn interest on yet.';
    case 'not_linked': return 'This member has not created a login yet, so there is no password to reset.';
    case 'demo_only': return 'Only the demo office can reset the demo.';
    case 'cross_site': return 'That request came from another site and was blocked.';
    case 'json_required': return 'Something went wrong sending the form. Please try again.';
    case 'not_found': return 'That record was not found.';
    case 'demo_missing': return 'The demo is not set up yet. Please try again in a moment.';
    case 'invalid':
      if (d.reason === 'required') return `${f || 'A field'} is required.`;
      if (d.reason === 'text') return `${f} must be text.`;
      return `${f || 'A value'} is not right: ${d.reason ?? 'check it'}.`;
    case 'server_error': return 'Something went wrong on our side. Nothing was saved. Please try again.';
    default: return 'Something went wrong. Nothing was saved. Please try again.';
  }
}

function rs(paisa: number) {
  const n = Number(paisa) / 100;
  return 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', {});
  }
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'server_error', data);
  return data as T;
}

export const get = <T = any>(p: string) => api<T>('GET', p);
export const post = <T = any>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});
export const put = <T = any>(p: string, b: unknown) => api<T>('PUT', p, b);
export const patch = <T = any>(p: string, b: unknown) => api<T>('PATCH', p, b);
