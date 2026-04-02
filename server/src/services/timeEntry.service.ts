import { supabase } from './supabase.js';
import { TimeEntry } from '@timeregistrering/shared';
import { badRequest, notFound, forbidden } from '../utils/errors.js';
import { getActiveSchedule, getNormalMinutesForDay } from './workSchedule.service.js';
import { recordFlexForTimeEntry, reverseFlexForTimeEntry } from './flex.service.js';
import { isNorwegianHoliday } from '../utils/norwegianHolidays.js';
import { jsWeekdayToNorwegian } from '../utils/dateUtils.js';
import {
  createNotification,
  notifyLeadersInDepartment,
} from './notification.service.js';
import { checkAllViolations } from './aml.service.js';
import { createAbsencePeriod } from './absencePeriod.service.js';

export async function getActiveEntry(userId: string): Promise<TimeEntry | null> {
  const { data } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', userId)
    .is('clock_out', null)
    .single();

  return data as TimeEntry | null;
}

export async function clockIn(userId: string, comment?: string): Promise<TimeEntry> {
  // Sjekk at ingen aktiv innstempeling eksisterer (DB-constraint håndterer det også)
  const existing = await getActiveEntry(userId);
  if (existing) {
    throw badRequest('Du er allerede innstemplet. Stempl ut først.');
  }

  // Sjekk om bruker har godkjent fravær i dag
  const today = new Date().toISOString().slice(0, 10);
  const { data: absenceToday } = await supabase
    .from('absence_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .lte('date_from', today)
    .gte('date_to', today)
    .limit(1);
  if (absenceToday && absenceToday.length > 0) {
    throw badRequest('Du har godkjent fravær i dag og kan ikke stemple inn');
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      user_id: userId,
      clock_in: new Date().toISOString(),
      comment: comment ?? null,
      status: 'draft',
    })
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke stemple inn');
  return data as TimeEntry;
}

export async function clockOut(entryId: string, userId: string, comment?: string, absenceCodeId?: string): Promise<TimeEntry> {
  const { data: entry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('user_id', userId)
    .single();

  if (!entry) throw notFound('Innstempeling');
  if (entry.clock_out) throw badRequest('Allerede stemplet ut');

  // Valider fraværskode hvis oppgitt
  if (absenceCodeId) {
    const { data: code } = await supabase
      .from('absence_codes')
      .select('id, allow_clock_out, is_active')
      .eq('id', absenceCodeId)
      .single();
    if (!code || !code.is_active) throw badRequest('Fraværskoden finnes ikke eller er inaktiv');
    if (!code.allow_clock_out) throw badRequest('Denne fraværskoden kan ikke brukes ved utstempling');
  }

  const clockOutTime = new Date();
  const clockIn = new Date(entry.clock_in);

  // Hent arbeidsplan og beregn normalminutter for dagen
  const schedule = await getActiveSchedule(userId, clockIn);
  if (!schedule) {
    console.warn(`[FLEX] Ingen arbeidsplan for bruker ${userId} — fleks beregnes med 0 normaltimer`);
  }
  const isHoliday = isNorwegianHoliday(clockIn);
  const weekday = isHoliday ? -1 : jsWeekdayToNorwegian(clockIn.getDay());
  const normalMinutes = schedule && !isHoliday ? getNormalMinutesForDay(schedule, weekday) : 0;

  const updateData: Record<string, unknown> = {
    clock_out: clockOutTime.toISOString(),
    status: 'draft',
    overtime_data: null,
    use_as_flex: true,
  };
  if (comment) updateData.comment = comment;

  const { data, error } = await supabase
    .from('time_entries')
    .update(updateData)
    .eq('id', entryId)
    .select('*, user:users!time_entries_user_id_fkey(name, employee_number, department_id)')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke stemple ut');

  // Oppdater fleksitid umiddelbart ved utsjekk: flex = faktisk tid - normaltid
  const actualMinutes = Math.round((clockOutTime.getTime() - clockIn.getTime()) / 60000);
  await recordFlexForTimeEntry(userId, entryId, actualMinutes, normalMinutes);

  // Opprett fraværsperiode hvis kode er valgt
  if (absenceCodeId) {
    await createAbsencePeriod(userId, absenceCodeId);
  }

  return data as TimeEntry;
}

export async function submitEntry(entryId: string, userId: string): Promise<TimeEntry> {
  const { data: entry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('user_id', userId)
    .single();

  if (!entry) throw notFound('Timeregistrering');
  if (entry.status !== 'draft') throw badRequest('Kan bare sende inn utkast');
  if (!entry.clock_out) throw badRequest('Stempl ut før du sender inn');

  const { data, error } = await supabase
    .from('time_entries')
    .update({ status: 'submitted' })
    .eq('id', entryId)
    .select('*, user:users!time_entries_user_id_fkey(name, employee_number, department_id)')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke sende inn');

  // Varsle leder
  const deptId = data.user?.department_id ?? null;
  await notifyLeadersInDepartment(
    deptId,
    'time_entry_submitted',
    'Timer sendt til godkjenning',
    `${data.user?.name} har sendt timer for godkjenning.`,
    entryId,
    'time_entry',
  );

  return data as TimeEntry;
}

export async function approveEntry(entryId: string, approverId: string): Promise<TimeEntry> {
  const { data: entry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (!entry) throw notFound('Timeregistrering');
  if (entry.status !== 'submitted') throw badRequest('Kan bare godkjenne innsendte timer');
  if (entry.user_id === approverId) throw badRequest('Du kan ikke godkjenne egne timer');

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', entryId)
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke godkjenne');

  // Varsle ansatt
  await createNotification(
    entry.user_id,
    'time_entry_approved',
    'Timer godkjent',
    'Timene dine er godkjent.',
    entryId,
    'time_entry',
  );

  // Kjør AML-sjekk asynkront — blokkerer ikke API-responsen
  checkAllViolations(entry.user_id).catch((err) =>
    console.error('AML-sjekk feilet etter godkjenning:', err),
  );

  return data as TimeEntry;
}

export async function rejectEntry(
  entryId: string,
  approverId: string,
  reason: string,
): Promise<TimeEntry> {
  const { data: entry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (!entry) throw notFound('Timeregistrering');
  if (entry.status !== 'submitted') throw badRequest('Kan bare avvise innsendte timer');
  if (entry.user_id === approverId) throw badRequest('Du kan ikke avvise egne timer');

  // Reverser fleksitiden som ble registrert ved utsjekk
  await reverseFlexForTimeEntry(entryId);

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      status: 'rejected',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', entryId)
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke avvise');

  // Varsle ansatt
  await createNotification(
    entry.user_id,
    'time_entry_rejected',
    'Timer avvist',
    `Timene dine ble avvist. Begrunnelse: ${reason}`,
    entryId,
    'time_entry',
  );

  return data as TimeEntry;
}

export async function listEntries(options: {
  userId?: string;
  departmentId?: string;
  status?: string;
  from?: string;
  to?: string;
  isAdmin?: boolean;
}): Promise<TimeEntry[]> {
  let query = supabase
    .from('time_entries')
    .select('*, user:users!time_entries_user_id_fkey(name, employee_number, department_id)')
    .order('clock_in', { ascending: false });

  if (options.userId) query = query.eq('user_id', options.userId);
  if (options.status) query = query.eq('status', options.status);
  if (options.from) query = query.gte('clock_in', options.from);
  if (options.to) query = query.lte('clock_in', options.to + 'T23:59:59');

  if (options.departmentId && !options.isAdmin) {
    // Filtrer til brukere i avdelingen
    const { data: deptUsers } = await supabase
      .from('users')
      .select('id')
      .eq('department_id', options.departmentId);
    const ids = (deptUsers ?? []).map((u: { id: string }) => u.id);
    if (ids.length > 0) query = query.in('user_id', ids);
  }

  const { data, error } = await query.limit(200);
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

export async function updateEntry(
  entryId: string,
  userId: string,
  patch: { clock_in?: string; clock_out?: string; comment?: string },
): Promise<TimeEntry> {
  const { data: entry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('user_id', userId)
    .single();

  if (!entry) throw notFound('Timeregistrering');
  if (entry.status !== 'draft') throw badRequest('Kan bare redigere utkast');

  const updateData: Record<string, unknown> = {};
  if (patch.comment !== undefined) updateData.comment = patch.comment;

  const newClockIn = patch.clock_in ? new Date(patch.clock_in) : new Date(entry.clock_in);
  const hasClockOut = patch.clock_out !== undefined || entry.clock_out;
  const newClockOut = patch.clock_out ? new Date(patch.clock_out) : entry.clock_out ? new Date(entry.clock_out) : null;

  if (patch.clock_in) {
    if (isNaN(newClockIn.getTime())) throw badRequest('Ugyldig innstemplingstidspunkt');
    updateData.clock_in = newClockIn.toISOString();
  }

  if (patch.clock_out) {
    if (!newClockOut || isNaN(newClockOut.getTime())) throw badRequest('Ugyldig utstemplingstidspunkt');
    if (newClockOut <= newClockIn) throw badRequest('Utstemplingstidspunkt må være etter innstemplingstidspunkt');
    updateData.clock_out = newClockOut.toISOString();
  }

  // Hvis tidspunkter er endret og innslaget har clock_out: reberegn flex
  const timesChanged = patch.clock_in || patch.clock_out;
  if (timesChanged && hasClockOut && newClockOut) {
    // Reverser eksisterende flex-transaksjon
    await reverseFlexForTimeEntry(entryId);

    // Beregn normalminutter for dagen
    const schedule = await getActiveSchedule(userId, newClockIn);
    if (!schedule) {
      console.warn(`[FLEX] Ingen arbeidsplan for bruker ${userId} — fleks beregnes med 0 normaltimer`);
    }
    const isHoliday = isNorwegianHoliday(newClockIn);
    const weekday = isHoliday ? -1 : jsWeekdayToNorwegian(newClockIn.getDay());
    const normalMinutes = schedule && !isHoliday ? getNormalMinutesForDay(schedule, weekday) : 0;

    updateData.overtime_data = null;

    const { data, error } = await supabase
      .from('time_entries')
      .update(updateData)
      .eq('id', entryId)
      .select('*')
      .single();

    if (error || !data) throw error ?? new Error('Kunne ikke oppdatere');

    // Registrer ny flex: faktisk tid - normaltid
    const actualMinutes = Math.round((newClockOut.getTime() - newClockIn.getTime()) / 60000);
    await recordFlexForTimeEntry(userId, entryId, actualMinutes, normalMinutes);

    return data as TimeEntry;
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update(updateData)
    .eq('id', entryId)
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke oppdatere');
  return data as TimeEntry;
}

export async function submitMonth(
  userId: string,
  yearMonth: string,
): Promise<{ submitted: number }> {
  const from = `${yearMonth}-01T00:00:00.000Z`;
  // Siste dag i måneden: første dag neste måned - 1 ms
  const [year, month] = yearMonth.split('-').map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  const to = `${nextMonth}-01T00:00:00.000Z`;

  const { data: drafts } = await supabase
    .from('time_entries')
    .select('id, user:users!time_entries_user_id_fkey(name, department_id)')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .not('clock_out', 'is', null)
    .gte('clock_in', from)
    .lt('clock_in', to);

  if (!drafts || drafts.length === 0) return { submitted: 0 };

  const ids = drafts.map((e: { id: string }) => e.id);

  const { error } = await supabase
    .from('time_entries')
    .update({ status: 'submitted' })
    .in('id', ids);

  if (error) throw error;

  // Én samlet varsling til leder
  const firstEntry = drafts[0] as { user?: { name?: string; department_id?: string } };
  const deptId = firstEntry.user?.department_id ?? null;
  const userName = firstEntry.user?.name ?? 'En ansatt';

  await notifyLeadersInDepartment(
    deptId,
    'time_entry_submitted',
    'Timer sendt til godkjenning',
    `${userName} har sendt ${drafts.length} timeregistrering${drafts.length > 1 ? 'er' : ''} for godkjenning (${yearMonth}).`,
    ids[0],
    'time_entry',
  );

  return { submitted: drafts.length };
}

/**
 * Leder/admin kan korrigere tidspunkter på en allerede godkjent stempling.
 * Reberegner flex og kjører full AML-sjekk etterpå.
 */
export async function adminUpdateEntry(
  entryId: string,
  patch: { clock_in?: string; clock_out?: string },
  actorId: string,
): Promise<TimeEntry> {
  const { data: entry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (!entry) throw notFound('Timeregistrering');
  if (entry.status !== 'approved') throw badRequest('Kun godkjente stemplinger kan korrigeres her');

  const newClockIn  = patch.clock_in  ? new Date(patch.clock_in)  : new Date(entry.clock_in);
  const newClockOut = patch.clock_out ? new Date(patch.clock_out) : new Date(entry.clock_out);

  if (isNaN(newClockIn.getTime()))  throw badRequest('Ugyldig innstemplingstidspunkt');
  if (isNaN(newClockOut.getTime())) throw badRequest('Ugyldig utstemplingstidspunkt');
  if (newClockOut <= newClockIn)    throw badRequest('Utstemplingstidspunkt må være etter innstemplingstidspunkt');

  // Reverser eksisterende flex-transaksjon og beregn på nytt
  await reverseFlexForTimeEntry(entryId);

  const schedule      = await getActiveSchedule(entry.user_id, newClockIn);
  if (!schedule) {
    console.warn(`[FLEX] Ingen arbeidsplan for bruker ${entry.user_id} — fleks beregnes med 0 normaltimer`);
  }
  const isHoliday     = isNorwegianHoliday(newClockIn);
  const weekday       = isHoliday ? -1 : jsWeekdayToNorwegian(newClockIn.getDay());
  const normalMinutes = schedule && !isHoliday ? getNormalMinutesForDay(schedule, weekday) : 0;

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      clock_in:    newClockIn.toISOString(),
      clock_out:   newClockOut.toISOString(),
      approved_by: actorId,
      approved_at: new Date().toISOString(),
      overtime_data: null,
    })
    .eq('id', entryId)
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke oppdatere');

  const actualMinutes = Math.round((newClockOut.getTime() - newClockIn.getTime()) / 60000);
  await recordFlexForTimeEntry(entry.user_id, entryId, actualMinutes, normalMinutes);

  // Varsle brukeren om korrigeringen
  const dateStr = newClockIn.toISOString().slice(0, 10).split('-').reverse().join('.');
  await createNotification(
    entry.user_id,
    'time_entry_edited',
    'Timer korrigert av administrator',
    `Din timeregistrering for ${dateStr} ble korrigert.`,
    entryId,
    'time_entry',
  );

  // Kjør full AML-sjekk asynkront etter endringen
  checkAllViolations(entry.user_id).catch((err) =>
    console.error('AML-sjekk feilet etter admin-korrigering:', err),
  );

  return data as TimeEntry;
}

export async function deleteEntry(entryId: string, userId: string, isAdmin: boolean): Promise<void> {
  const { data: entry } = await supabase
    .from('time_entries')
    .select('user_id, status')
    .eq('id', entryId)
    .single();

  if (!entry) throw notFound('Timeregistrering');

  const isOwner = entry.user_id === userId;
  const isDraft = entry.status === 'draft';

  if (!isAdmin && (!isOwner || !isDraft)) {
    throw forbidden();
  }

  // Reverser eventuell fleksitid før sletting
  await reverseFlexForTimeEntry(entryId);
  await supabase.from('time_entries').delete().eq('id', entryId);
}
