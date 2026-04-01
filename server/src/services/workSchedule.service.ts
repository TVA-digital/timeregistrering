import { supabase } from './supabase.js';
import {
  WorkSchedule,
  UserScheduleAssignment,
  CreateWorkScheduleBody,
  CreateScheduleAssignmentBody,
} from '@timeregistrering/shared';
import { notFound, badRequest } from '../utils/errors.js';

/**
 * Henter aktiv arbeidsplan for en bruker på en gitt dato.
 * Returnerer null hvis ingen plan er tilordnet.
 * Brukes av flex-beregning, godkjenning osv. — signatur er uendret.
 */
export async function getActiveSchedule(
  userId: string,
  date: Date,
): Promise<WorkSchedule | null> {
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD

  const { data } = await supabase
    .from('user_schedule_assignments')
    .select('schedule:work_schedules(*, days:work_schedule_days(*))')
    .eq('user_id', userId)
    .lte('effective_from', dateStr)
    .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single();

  return (data as { schedule: WorkSchedule } | null)?.schedule ?? null;
}

/**
 * Returnerer antall minutter normalt planlagt for en gitt ukedag
 * basert på arbeidsplanen. weekday: 0=man … 6=søn.
 */
export function getNormalMinutesForDay(
  schedule: WorkSchedule,
  weekday: number,
): number {
  const day = schedule.days.find((d) => d.weekday === weekday);
  return day ? Math.round(day.hours * 60) : 0;
}

/**
 * Returnerer alle tilordninger (aktive og historiske) for en bruker,
 * med tilhørende arbeidsplanmal, sortert nyeste først.
 */
export async function listSchedulesForUser(
  userId: string,
): Promise<UserScheduleAssignment[]> {
  const { data, error } = await supabase
    .from('user_schedule_assignments')
    .select('*, schedule:work_schedules(*, days:work_schedule_days(*))')
    .eq('user_id', userId)
    .order('effective_from', { ascending: false });

  if (error) throw error;
  return (data ?? []) as UserScheduleAssignment[];
}

/**
 * Henter alle arbeidsplanmaler (ikke bruker-spesifikke), sortert på navn.
 */
export async function listAllSchedules(): Promise<WorkSchedule[]> {
  const { data, error } = await supabase
    .from('work_schedules')
    .select('*, days:work_schedule_days(*)')
    .order('name');

  if (error) throw error;
  return (data ?? []) as WorkSchedule[];
}

/**
 * Oppretter en ny arbeidsplanmal (ingen bruker- eller datotilknytning).
 */
export async function createSchedule(
  body: CreateWorkScheduleBody,
): Promise<WorkSchedule> {
  if (!body.name?.trim()) throw badRequest('Navn på arbeidsplan er påkrevd');

  const { data: schedule, error: schedError } = await supabase
    .from('work_schedules')
    .insert({ name: body.name.trim() })
    .select('id, name, created_at')
    .single();

  if (schedError || !schedule) throw schedError ?? new Error('Kunne ikke opprette arbeidsplan');

  if (body.days?.length) {
    const { error: daysError } = await supabase
      .from('work_schedule_days')
      .insert(body.days.map((d) => ({ schedule_id: schedule.id, weekday: d.weekday, hours: d.hours })));
    if (daysError) throw daysError;
  }

  // Hent ferdig objekt med days
  const { data: full, error: fetchError } = await supabase
    .from('work_schedules')
    .select('*, days:work_schedule_days(*)')
    .eq('id', schedule.id)
    .single();

  if (fetchError || !full) throw fetchError ?? new Error('Feil ved henting av arbeidsplan');
  return full as WorkSchedule;
}

/**
 * Tilordner en arbeidsplanmal til en bruker fra en gitt dato.
 * Lukker automatisk eventuelle åpne tilordninger for brukeren.
 */
export async function assignScheduleToUser(
  body: CreateScheduleAssignmentBody,
): Promise<UserScheduleAssignment> {
  // Valider at malen finnes
  const { data: schedule } = await supabase
    .from('work_schedules')
    .select('id')
    .eq('id', body.schedule_id)
    .single();
  if (!schedule) throw notFound('Arbeidsplan');

  // Beregn dagen før den nye startdatoen for å lukke gammel tilordning
  const newStart = new Date(body.effective_from);
  const dayBefore = new Date(newStart);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayBeforeStr = dayBefore.toISOString().slice(0, 10);

  // Lukk eksisterende åpen tilordning (effective_to IS NULL)
  await supabase
    .from('user_schedule_assignments')
    .update({ effective_to: dayBeforeStr })
    .eq('user_id', body.user_id)
    .is('effective_to', null)
    .lt('effective_from', body.effective_from);

  // Opprett ny tilordning
  const { data, error } = await supabase
    .from('user_schedule_assignments')
    .insert({
      user_id: body.user_id,
      schedule_id: body.schedule_id,
      effective_from: body.effective_from,
    })
    .select('*, schedule:work_schedules(*, days:work_schedule_days(*))')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke tilordne arbeidsplan');
  return data as UserScheduleAssignment;
}
