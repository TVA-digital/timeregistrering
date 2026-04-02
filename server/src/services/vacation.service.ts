import { supabase } from './supabase.js';
import { VacationBalance } from '@timeregistrering/shared';
import { isNorwegianHoliday } from '../utils/norwegianHolidays.js';

// Teller arbeidsdager (man-fre, unntatt norske helligdager) i perioden
export function calcVacationDays(dateFrom: string, dateTo: string): number {
  let days = 0;
  const current = new Date(dateFrom);
  const end = new Date(dateTo);

  while (current <= end) {
    const dow = current.getDay(); // 0=Søn, 6=Lør
    if (dow !== 0 && dow !== 6 && !isNorwegianHoliday(current)) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export async function getVacationBalance(userId: string): Promise<VacationBalance> {
  const { data, error } = await supabase
    .from('vacation_balance')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { user_id: userId, remaining_days: 25, updated_at: new Date().toISOString() };
  }
  return data as VacationBalance;
}

export async function deductVacationDays(
  userId: string,
  absenceRequestId: string,
  days: number,
  description: string,
): Promise<void> {
  await supabase.from('vacation_transactions').insert({
    user_id: userId,
    absence_request_id: absenceRequestId,
    days: -days,
    description,
  });

  const { error } = await supabase.rpc('update_vacation_balance', {
    p_user_id: userId,
    p_delta_days: -days,
  });

  if (error) throw error;
}

export async function reverseVacationDeduction(absenceRequestId: string): Promise<void> {
  const { data: txs } = await supabase
    .from('vacation_transactions')
    .select('user_id, days')
    .eq('absence_request_id', absenceRequestId);

  if (!txs || txs.length === 0) return;

  const totalDays = (txs as { user_id: string; days: number }[]).reduce(
    (sum, t) => sum + t.days,
    0,
  );
  if (totalDays === 0) return;

  const userId = (txs[0] as { user_id: string }).user_id;

  await supabase.from('vacation_transactions').insert({
    user_id: userId,
    absence_request_id: absenceRequestId,
    days: -totalDays,
    description: 'Reversering av feriesøknad',
  });

  const { error } = await supabase.rpc('update_vacation_balance', {
    p_user_id: userId,
    p_delta_days: -totalDays,
  });

  if (error) throw error;
}

export async function setVacationBalance(userId: string, days: number): Promise<void> {
  const { error } = await supabase
    .from('vacation_balance')
    .upsert({ user_id: userId, remaining_days: days, updated_at: new Date().toISOString() });

  if (error) throw error;
}
