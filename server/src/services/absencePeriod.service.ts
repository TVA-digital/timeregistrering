import { supabase } from './supabase.js';
import { AbsencePeriod, TimeEntry } from '@timeregistrering/shared';
import { notFound, badRequest } from '../utils/errors.js';
import { clockIn } from './timeEntry.service.js';
import { reverseFlexForAbsencePeriod } from './flex.service.js';

export async function listAbsencePeriods(
  userId: string,
  from: string,
  to: string,
): Promise<AbsencePeriod[]> {
  const { data, error } = await supabase
    .from('absence_periods')
    .select('*, absence_code:absence_codes(*)')
    .eq('user_id', userId)
    .gte('started_at', from)
    .lte('started_at', to + 'T23:59:59')
    .order('started_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AbsencePeriod[];
}

export async function getActiveAbsencePeriod(userId: string): Promise<AbsencePeriod | null> {
  const { data } = await supabase
    .from('absence_periods')
    .select('*, absence_code:absence_codes(*)')
    .eq('user_id', userId)
    .is('ended_at', null)
    .single();

  return (data as AbsencePeriod | null) ?? null;
}

export async function createAbsencePeriod(
  userId: string,
  absenceCodeId: string,
): Promise<AbsencePeriod> {
  const { data, error } = await supabase
    .from('absence_periods')
    .insert({
      user_id: userId,
      absence_code_id: absenceCodeId,
      started_at: new Date().toISOString(),
    })
    .select('*, absence_code:absence_codes(*)')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke opprette fraværsperiode');
  return data as AbsencePeriod;
}

export async function endAbsencePeriod(
  periodId: string,
  userId: string,
  returnToWork: boolean,
): Promise<{ absencePeriod: AbsencePeriod; newTimeEntry?: TimeEntry }> {
  // Hent fraværsperioden med fraværskode
  const { data: period } = await supabase
    .from('absence_periods')
    .select('*, absence_code:absence_codes(*)')
    .eq('id', periodId)
    .eq('user_id', userId)
    .single();

  if (!period) throw notFound('Fraværsperiode');
  if (period.ended_at) throw badRequest('Fraværsperioden er allerede avsluttet');

  const endedAt = new Date();
  const startedAt = new Date(period.started_at);
  const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  // Beregn flex-effekt basert på koden
  const absenceCode = period.absence_code;
  const flexMinutes = absenceCode?.deducts_flex
    ? -durationMinutes
    : absenceCode?.adds_flex
      ? durationMinutes   // positiv flex — tilstedeværelseskode
      : 0;

  // Avslutt fraværsperioden
  const { data: updatedPeriod, error } = await supabase
    .from('absence_periods')
    .update({
      ended_at: endedAt.toISOString(),
      flex_minutes: flexMinutes,
    })
    .eq('id', periodId)
    .select('*, absence_code:absence_codes(*)')
    .single();

  if (error || !updatedPeriod) throw error ?? new Error('Kunne ikke avslutte fraværsperiode');

  // Registrer flex-trekk hvis koden trekker flex
  if (flexMinutes !== 0) {
    const hours = Math.abs(Math.round(durationMinutes / 60 * 10) / 10);
    const description = `Fravær (${absenceCode?.name ?? 'ukjent'}): ${hours} t`;

    await supabase.from('flex_transactions').insert({
      user_id: userId,
      absence_period_id: periodId,
      minutes: flexMinutes,
      description,
    });

    await supabase.rpc('update_flex_balance', {
      p_user_id: userId,
      p_delta_minutes: flexMinutes,
    });
  }

  // Hvis ansatt skal tilbake til jobb: opprett ny innstempeling
  let newTimeEntry: TimeEntry | undefined;
  if (returnToWork) {
    newTimeEntry = await clockIn(userId);
  }

  return { absencePeriod: updatedPeriod as AbsencePeriod, newTimeEntry };
}

export async function updateAbsencePeriod(
  periodId: string,
  userId: string,
  patch: { started_at?: string; ended_at?: string },
): Promise<AbsencePeriod> {
  const { data: period } = await supabase
    .from('absence_periods')
    .select('*, absence_code:absence_codes(*)')
    .eq('id', periodId)
    .eq('user_id', userId)
    .single();

  if (!period) throw notFound('Fraværsperiode');

  const newStartedAt = patch.started_at ? new Date(patch.started_at) : new Date(period.started_at);
  const newEndedAt = patch.ended_at ? new Date(patch.ended_at) : period.ended_at ? new Date(period.ended_at) : null;

  if (isNaN(newStartedAt.getTime())) throw badRequest('Ugyldig starttidspunkt');
  if (newEndedAt) {
    if (isNaN(newEndedAt.getTime())) throw badRequest('Ugyldig sluttidspunkt');
    if (newEndedAt <= newStartedAt) throw badRequest('Sluttidspunkt må være etter starttidspunkt');
  }

  const updateData: Record<string, unknown> = {
    started_at: newStartedAt.toISOString(),
  };
  if (newEndedAt) updateData.ended_at = newEndedAt.toISOString();

  // Reberegn flex hvis perioden er avsluttet og tidspunkter er endret
  if (newEndedAt && (patch.started_at || patch.ended_at)) {
    await reverseFlexForAbsencePeriod(periodId);

    const durationMinutes = Math.round((newEndedAt.getTime() - newStartedAt.getTime()) / 60000);
    const absenceCode = period.absence_code;
    const flexMinutes = absenceCode?.deducts_flex
      ? -durationMinutes
      : absenceCode?.adds_flex
        ? durationMinutes
        : 0;

    updateData.flex_minutes = flexMinutes;

    if (flexMinutes !== 0) {
      const hours = Math.abs(Math.round(durationMinutes / 60 * 10) / 10);
      const description = `Fravær (${absenceCode?.name ?? 'ukjent'}): ${hours} t`;
      await supabase.from('flex_transactions').insert({
        user_id: userId,
        absence_period_id: periodId,
        minutes: flexMinutes,
        description,
      });
      await supabase.rpc('update_flex_balance', {
        p_user_id: userId,
        p_delta_minutes: flexMinutes,
      });
    }
  }

  const { data, error } = await supabase
    .from('absence_periods')
    .update(updateData)
    .eq('id', periodId)
    .select('*, absence_code:absence_codes(*)')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke oppdatere fraværsperiode');
  return data as AbsencePeriod;
}

export async function deleteAbsencePeriod(
  periodId: string,
  userId: string,
): Promise<void> {
  const { data: period } = await supabase
    .from('absence_periods')
    .select('id, user_id, ended_at')
    .eq('id', periodId)
    .eq('user_id', userId)
    .single();

  if (!period) throw notFound('Fraværsperiode');

  // Reverser flex-transaksjon hvis perioden var avsluttet
  if (period.ended_at) {
    await reverseFlexForAbsencePeriod(periodId);
  }

  await supabase.from('absence_periods').delete().eq('id', periodId);
}
