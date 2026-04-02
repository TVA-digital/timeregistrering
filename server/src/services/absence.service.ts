import { supabase } from './supabase.js';
import {
  AbsenceCode,
  AbsenceRequest,
  CreateAbsenceCodeBody,
  UpdateAbsenceCodeBody,
  CreateAbsenceRequestBody,
} from '@timeregistrering/shared';
import { notFound, badRequest } from '../utils/errors.js';
import { createNotification, notifyLeadersInDepartment } from './notification.service.js';
import { recordFlexForAbsence, reverseFlexForAbsenceRequest } from './flex.service.js';
import { getActiveSchedule, getNormalMinutesForDay } from './workSchedule.service.js';
import { isNorwegianHoliday } from '../utils/norwegianHolidays.js';
import { jsWeekdayToNorwegian } from '../utils/dateUtils.js';

// --- Fraværskoder ---

export async function listAbsenceCodes(activeOnly = true): Promise<AbsenceCode[]> {
  let query = supabase.from('absence_codes').select('*').order('code');
  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AbsenceCode[];
}

export async function createAbsenceCode(body: CreateAbsenceCodeBody): Promise<AbsenceCode> {
  const { data, error } = await supabase
    .from('absence_codes')
    .insert(body)
    .select()
    .single();

  if (error) throw error;
  return data as AbsenceCode;
}

export async function updateAbsenceCode(
  id: string,
  body: UpdateAbsenceCodeBody,
): Promise<AbsenceCode> {
  const { data, error } = await supabase
    .from('absence_codes')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw notFound('Fraværskode');
  return data as AbsenceCode;
}

// --- Fraværssøknader ---

export async function createAbsenceRequest(
  userId: string,
  body: CreateAbsenceRequestBody,
): Promise<AbsenceRequest> {
  const code = await supabase
    .from('absence_codes')
    .select('requires_approval, is_active, deducts_flex, name')
    .eq('id', body.absence_code_id)
    .single();

  if (!code.data?.is_active) throw badRequest('Fraværskoden er ikke aktiv');

  // Sjekk overlapp med eksisterende godkjente timer i perioden
  const { data: overlapping } = await supabase
    .from('time_entries')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['approved', 'submitted'])
    .gte('clock_in', body.date_from)
    .lte('clock_in', body.date_to + 'T23:59:59')
    .limit(1);
  if (overlapping && overlapping.length > 0) {
    throw badRequest('Det finnes allerede innsendte eller godkjente timer i denne perioden');
  }

  const initialStatus = code.data.requires_approval ? 'pending' : 'approved';

  const { data, error } = await supabase
    .from('absence_requests')
    .insert({
      user_id: userId,
      absence_code_id: body.absence_code_id,
      date_from: body.date_from,
      date_to: body.date_to,
      hours_per_day: body.hours_per_day ?? null,
      comment: body.comment ?? null,
      status: initialStatus,
    })
    .select('*, absence_code:absence_codes(*), user:users!absence_requests_user_id_fkey(name, employee_number, department_id)')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke opprette fraværssøknad');

  // Trekk fra fleksitid ved auto-godkjenning (ingen godkjenning nødvendig)
  if (!code.data.requires_approval && code.data.deducts_flex) {
    const totalMinutes = await calcAbsenceFlexMinutes(userId, data as AbsenceRequest);
    if (totalMinutes > 0) {
      await recordFlexForAbsence(
        userId,
        data.id,
        -totalMinutes,
        `Fravær: ${code.data.name} (${data.date_from}${data.date_from !== data.date_to ? ' – ' + data.date_to : ''})`,
      );
    }
  }

  // Varsle leder om søknaden krever godkjenning
  if (code.data.requires_approval) {
    const deptId = data.user?.department_id ?? null;
    await notifyLeadersInDepartment(
      deptId,
      'absence_submitted',
      'Ny fraværssøknad',
      `${data.user?.name} har søkt om fravær (${data.absence_code?.name}).`,
      data.id,
      'absence_request',
    );
  }

  return data as AbsenceRequest;
}

export async function listAbsenceRequests(options: {
  userId?: string;
  departmentId?: string;
  status?: string;
  isAdmin?: boolean;
  dateFrom?: string;
  dateTo?: string;
}): Promise<AbsenceRequest[]> {
  let query = supabase
    .from('absence_requests')
    .select('*, absence_code:absence_codes(*), user:users!absence_requests_user_id_fkey(name, employee_number, department_id)')
    .order('date_from', { ascending: false });

  if (options.userId) query = query.eq('user_id', options.userId);
  if (options.status) query = query.eq('status', options.status);

  // Overlapp-filter: fravær som delvis overlapper perioden
  if (options.dateFrom) query = query.lte('date_from', options.dateTo ?? options.dateFrom);
  if (options.dateTo) query = query.gte('date_to', options.dateFrom ?? options.dateTo);

  if (options.departmentId && !options.isAdmin) {
    const { data: deptUsers } = await supabase
      .from('users')
      .select('id')
      .eq('department_id', options.departmentId);
    const ids = (deptUsers ?? []).map((u: { id: string }) => u.id);
    if (ids.length > 0) query = query.in('user_id', ids);
  }

  const { data, error } = await query.limit(200);
  if (error) throw error;
  return (data ?? []) as AbsenceRequest[];
}

export async function approveAbsenceRequest(
  requestId: string,
  approverId: string,
): Promise<AbsenceRequest> {
  const { data: req } = await supabase
    .from('absence_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (!req) throw notFound('Fraværssøknad');
  if (req.status !== 'pending') throw badRequest('Søknaden er allerede behandlet');
  if (req.user_id === approverId) throw badRequest('Du kan ikke godkjenne egne fraværssøknader');

  const { data, error } = await supabase
    .from('absence_requests')
    .update({
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*, absence_code:absence_codes(*)')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke godkjenne');

  // Trekk fra fleksitid hvis fraværskoden krever det
  if (data.absence_code?.deducts_flex) {
    const totalMinutes = await calcAbsenceFlexMinutes(req.user_id, data);
    if (totalMinutes > 0) {
      await recordFlexForAbsence(
        req.user_id,
        requestId,
        -totalMinutes,
        `Fravær: ${data.absence_code.name} (${data.date_from}${data.date_from !== data.date_to ? ' – ' + data.date_to : ''})`,
      );
    }
  }

  await createNotification(
    req.user_id,
    'absence_approved',
    'Fraværssøknad godkjent',
    `Fraværssøknaden din (${data.absence_code?.name}) er godkjent.`,
    requestId,
    'absence_request',
  );

  return data as AbsenceRequest;
}

// Beregn antall flex-minutter som skal trekkes for en fraværssøknad
async function calcAbsenceFlexMinutes(userId: string, req: AbsenceRequest): Promise<number> {
  let total = 0;
  const current = new Date(req.date_from);
  const end = new Date(req.date_to);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0=Søn, 6=Lør
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = isNorwegianHoliday(current);

    if (!isWeekend && !isHoliday) {
      if (req.hours_per_day != null) {
        total += req.hours_per_day * 60;
      } else {
        const schedule = await getActiveSchedule(userId, current);
        if (schedule) {
          const norwegianWeekday = jsWeekdayToNorwegian(dayOfWeek);
          total += getNormalMinutesForDay(schedule, norwegianWeekday);
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return total;
}

export async function updateAbsenceRequest(
  requestId: string,
  userId: string,
  patch: { hours_per_day?: number | null; comment?: string | null },
): Promise<AbsenceRequest> {
  const { data: existing } = await supabase
    .from('absence_requests')
    .select('*, absence_code:absence_codes(requires_approval, deducts_flex, name)')
    .eq('id', requestId)
    .eq('user_id', userId)
    .single();

  if (!existing) throw notFound('Fraværssøknad');
  if (existing.status !== 'pending' && existing.status !== 'rejected' && existing.absence_code?.requires_approval) {
    throw badRequest('Kan ikke redigere fraværssøknad etter at den er behandlet');
  }

  // Reverser eksisterende flex-trekk, beregn på nytt etter endring
  if (existing.absence_code?.deducts_flex) {
    await reverseFlexForAbsenceRequest(requestId);
  }

  const { data, error } = await supabase
    .from('absence_requests')
    .update({
      hours_per_day: patch.hours_per_day !== undefined ? patch.hours_per_day : existing.hours_per_day,
      comment: patch.comment !== undefined ? patch.comment : existing.comment,
      // Reset to pending so the leader must re-evaluate after employee edits a rejected request
      ...(existing.status === 'rejected' ? { status: 'pending', approved_by: null, approved_at: null, rejection_reason: null } : {}),
    })
    .eq('id', requestId)
    .select('*, absence_code:absence_codes(*)')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke oppdatere fraværssøknad');

  // Registrer nytt flex-trekk med oppdaterte verdier
  if (existing.absence_code?.deducts_flex) {
    const totalMinutes = await calcAbsenceFlexMinutes(userId, data as AbsenceRequest);
    if (totalMinutes > 0) {
      await recordFlexForAbsence(
        userId,
        requestId,
        -totalMinutes,
        `Fravær: ${existing.absence_code.name} (${data.date_from}${data.date_from !== data.date_to ? ' – ' + data.date_to : ''})`,
      );
    }
  }

  return data as AbsenceRequest;
}

export async function deleteAbsenceRequest(
  requestId: string,
  userId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('absence_requests')
    .select('*, absence_code:absence_codes(requires_approval, deducts_flex)')
    .eq('id', requestId)
    .eq('user_id', userId)
    .single();

  if (!existing) throw notFound('Fraværssøknad');
  if (existing.status !== 'pending' && existing.status !== 'rejected' && existing.absence_code?.requires_approval) {
    throw badRequest('Kan ikke slette fraværssøknad etter at den er behandlet');
  }

  // Reverser flex-trekk hvis fraværskoden trakk fra flex
  if (existing.absence_code?.deducts_flex) {
    await reverseFlexForAbsenceRequest(requestId);
  }

  await supabase.from('absence_requests').delete().eq('id', requestId);
}

export async function rejectAbsenceRequest(
  requestId: string,
  approverId: string,
  reason: string,
): Promise<AbsenceRequest> {
  const { data: req } = await supabase
    .from('absence_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (!req) throw notFound('Fraværssøknad');
  if (req.status !== 'pending') throw badRequest('Søknaden er allerede behandlet');
  if (req.user_id === approverId) throw badRequest('Du kan ikke avvise egne fraværssøknader');

  const { data, error } = await supabase
    .from('absence_requests')
    .update({
      status: 'rejected',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', requestId)
    .select('*, absence_code:absence_codes(*)')
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke avvise');

  await createNotification(
    req.user_id,
    'absence_rejected',
    'Fraværssøknad avvist',
    `Fraværssøknaden din ble avvist. Begrunnelse: ${reason}`,
    requestId,
    'absence_request',
  );

  return data as AbsenceRequest;
}
