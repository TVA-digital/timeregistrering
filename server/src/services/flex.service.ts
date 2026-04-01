import { supabase } from './supabase.js';
import { FlexBalance, FlexTransaction } from '@timeregistrering/shared';

// Beregn og registrer fleksitidstransaksjon ved utstempling
export async function recordFlexForTimeEntry(
  userId: string,
  timeEntryId: string,
  actualMinutes: number,
  normalMinutes: number,
  overtimeMinutes = 0,
): Promise<void> {
  // Trekk fra overtidstimer som allerede gir ekstra lønn — disse skal ikke også gi flex
  const flexMinutes = actualMinutes - normalMinutes - overtimeMinutes;

  const description = `Faktisk: ${Math.round(actualMinutes / 60 * 10) / 10} t | Normaltid: ${Math.round(normalMinutes / 60 * 10) / 10} t`;

  await supabase.from('flex_transactions').insert({
    user_id: userId,
    time_entry_id: timeEntryId,
    minutes: flexMinutes,
    description,
  });

  const { error } = await supabase.rpc('update_flex_balance', {
    p_user_id: userId,
    p_delta_minutes: flexMinutes,
  });

  if (error) throw error;
}

// Registrer flex-trekk ved godkjenning av fraværssøknad (deducts_flex = true)
export async function recordFlexForAbsence(
  userId: string,
  absenceRequestId: string,
  minutes: number,
  description: string,
): Promise<void> {
  await supabase.from('flex_transactions').insert({
    user_id: userId,
    absence_request_id: absenceRequestId,
    minutes,
    description,
  });

  const { error } = await supabase.rpc('update_flex_balance', {
    p_user_id: userId,
    p_delta_minutes: minutes,
  });

  if (error) throw error;
}

// Reverser flex-transaksjon for en fraværsperiode
export async function reverseFlexForAbsencePeriod(absencePeriodId: string): Promise<void> {
  const { data: tx } = await supabase
    .from('flex_transactions')
    .select('user_id, minutes')
    .eq('absence_period_id', absencePeriodId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!tx) return;

  await supabase.from('flex_transactions').insert({
    user_id: tx.user_id,
    absence_period_id: absencePeriodId,
    minutes: -tx.minutes,
    description: 'Reversering av fraværsperiode',
  });

  await supabase.rpc('update_flex_balance', {
    p_user_id: tx.user_id,
    p_delta_minutes: -tx.minutes,
  });
}

// Reverser flex-transaksjon (brukes hvis en godkjenning angres)
export async function reverseFlexForTimeEntry(timeEntryId: string): Promise<void> {
  const { data: tx } = await supabase
    .from('flex_transactions')
    .select('user_id, minutes')
    .eq('time_entry_id', timeEntryId)
    .gt('minutes', Number.MIN_SAFE_INTEGER) // hent positiv original (ikke reverseringer)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!tx) return;

  await supabase.from('flex_transactions').insert({
    user_id: tx.user_id,
    time_entry_id: timeEntryId,
    minutes: -tx.minutes,
    description: 'Reversering av godkjenning',
  });

  await supabase.rpc('update_flex_balance', {
    p_user_id: tx.user_id,
    p_delta_minutes: -tx.minutes,
  });
}

// Reverser flex-transaksjon for en fraværssøknad (brukes ved sletting/endring)
export async function reverseFlexForAbsenceRequest(absenceRequestId: string): Promise<void> {
  const { data: txs } = await supabase
    .from('flex_transactions')
    .select('user_id, minutes')
    .eq('absence_request_id', absenceRequestId);

  if (!txs || txs.length === 0) return;

  const totalMinutes = (txs as { user_id: string; minutes: number }[]).reduce(
    (sum, t) => sum + t.minutes,
    0,
  );
  if (totalMinutes === 0) return;

  const userId = (txs[0] as { user_id: string }).user_id;

  await supabase.from('flex_transactions').insert({
    user_id: userId,
    absence_request_id: absenceRequestId,
    minutes: -totalMinutes,
    description: 'Reversering av fraværssøknad',
  });

  await supabase.rpc('update_flex_balance', {
    p_user_id: userId,
    p_delta_minutes: -totalMinutes,
  });
}

export async function getFlexBalance(userId: string): Promise<FlexBalance> {
  const { data, error } = await supabase
    .from('flex_balance')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Returner nullsaldo hvis ingen rad finnes ennå
    return { user_id: userId, balance_minutes: 0, updated_at: new Date().toISOString() };
  }
  return data as FlexBalance;
}

export async function getFlexTransactions(userId: string): Promise<FlexTransaction[]> {
  const { data, error } = await supabase
    .from('flex_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as FlexTransaction[];
}
