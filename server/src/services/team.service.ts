import { supabase } from './supabase.js';
import { TeamMemberStatus } from '@timeregistrering/shared';

export async function getTeamStatus(
  departmentId: string | null,
  groupId: string | null,
  from: string,
  to: string,
): Promise<TeamMemberStatus[]> {
  // 1. Hent alle aktive brukere i avdelingen/gruppen (eller alle for admin)
  let userQuery = supabase
    .from('users')
    .select('id, name, employee_number')
    .eq('is_active', true)
    .order('name');

  if (groupId) {
    userQuery = userQuery.eq('group_id', groupId);
  } else if (departmentId) {
    userQuery = userQuery.eq('department_id', departmentId);
  }

  const { data: users, error: usersError } = await userQuery;
  if (usersError) throw usersError;
  if (!users || users.length === 0) return [];

  const userIds = users.map((u) => u.id);

  // 2. Hent aktive time entries (innstemplet nå) for alle i avdelingen
  const { data: activeEntries } = await supabase
    .from('time_entries')
    .select('id, user_id, clock_in')
    .in('user_id', userIds)
    .is('clock_out', null);

  // 3. Hent aktive fraværsperioder for alle i avdelingen
  const { data: activePeriods } = await supabase
    .from('absence_periods')
    .select('id, user_id, started_at, absence_code:absence_codes(id, name, adds_flex)')
    .in('user_id', userIds)
    .is('ended_at', null);

  // 4. Hent flex-saldo for alle i avdelingen
  const { data: flexBalances } = await supabase
    .from('flex_balance')
    .select('user_id, balance_minutes')
    .in('user_id', userIds);

  // 5. Hent avsluttede fraværsperioder i perioden for å summere timer per kode
  const { data: periodHistory } = await supabase
    .from('absence_periods')
    .select('user_id, absence_code_id, started_at, ended_at')
    .in('user_id', userIds)
    .not('ended_at', 'is', null)
    .gte('started_at', from)
    .lte('started_at', to + 'T23:59:59');

  // Bygg oppslagstabeller
  const activeEntryByUser = new Map<string, { id: string; clock_in: string }>();
  for (const e of (activeEntries ?? [])) {
    activeEntryByUser.set(e.user_id, { id: e.id, clock_in: e.clock_in });
  }

  const activePeriodByUser = new Map<string, TeamMemberStatus['activeAbsencePeriod']>();
  for (const p of (activePeriods ?? []) as (typeof activePeriods extends (infer T)[] | null ? T : never)[]) {
    const code = (p as unknown as { absence_code?: { id?: string; name?: string; adds_flex?: boolean } }).absence_code;
    if (!code) continue;
    activePeriodByUser.set(p.user_id, {
      id: p.id,
      started_at: p.started_at,
      absence_code: {
        id: code.id ?? '',
        name: code.name ?? '',
        adds_flex: code.adds_flex ?? false,
      },
    });
  }

  const flexByUser = new Map<string, number>();
  for (const f of (flexBalances ?? [])) {
    flexByUser.set(f.user_id, f.balance_minutes);
  }

  // Aggreger fraværsminutter per bruker per kode
  const absenceMinutesByUserAndCode = new Map<string, Record<string, number>>();
  for (const p of (periodHistory ?? [])) {
    if (!p.ended_at || !p.absence_code_id) continue;
    const minutes = Math.round(
      (new Date(p.ended_at).getTime() - new Date(p.started_at).getTime()) / 60000,
    );
    if (!absenceMinutesByUserAndCode.has(p.user_id)) {
      absenceMinutesByUserAndCode.set(p.user_id, {});
    }
    const byCode = absenceMinutesByUserAndCode.get(p.user_id)!;
    byCode[p.absence_code_id] = (byCode[p.absence_code_id] ?? 0) + minutes;
  }

  // Bygg resultat
  return users.map((user) => ({
    user: {
      id: user.id,
      name: user.name,
      employee_number: user.employee_number,
    },
    flexBalanceMinutes: flexByUser.get(user.id) ?? 0,
    activeTimeEntry: activeEntryByUser.get(user.id) ?? null,
    activeAbsencePeriod: activePeriodByUser.get(user.id) ?? null,
    absenceMinutesByCode: absenceMinutesByUserAndCode.get(user.id) ?? {},
  }));
}
