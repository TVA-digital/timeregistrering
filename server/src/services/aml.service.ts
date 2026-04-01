import { supabase } from './supabase.js';
import { AmlRule, AmlRuleType, AmlViolation } from '@timeregistrering/shared';
import { isNorwegianHoliday } from '../utils/norwegianHolidays.js';
import { notifyTeamLeadersForUser } from './notification.service.js';

// --- Hjelpefunksjoner ---

/**
 * Teller kalenderarbeidsdager (Man–Fre ekskl. norske helligdager)
 * mellom to datoer (inklusiv begge ender).
 */
function countCalendarWorkdays(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dow = current.getDay(); // 0=søn, 6=lør
    if (dow !== 0 && dow !== 6 && !isNorwegianHoliday(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/** Henter gjeldende AML-regler (første rad). Returnerer null om ingen rad finnes. */
async function getAmlRules(): Promise<AmlRule | null> {
  const { data } = await supabase.from('aml_rules').select('*').limit(1).single();
  return (data as AmlRule) ?? null;
}

/**
 * Sjekker om det allerede finnes et åpent brudd for samme bruker og regeltype
 * opprettet de siste 30 dagene — brukes for å unngå dupliserte rader.
 */
async function hasOpenViolation(userId: string, ruleType: AmlRuleType): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { count } = await supabase
    .from('aml_violations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('rule_type', ruleType)
    .gte('violated_at', since.toISOString());

  return (count ?? 0) > 0;
}

/**
 * Oppretter en violation-rad og varsler leder/fagleder.
 * Setter notified=true etter at varselet er sendt.
 */
async function createViolationAndNotify(
  userId: string,
  userName: string,
  ruleType: AmlRuleType,
  windowStart: Date,
  windowEnd: Date,
  actualHours: number,
  limitHours: number,
): Promise<void> {
  const { data: violation, error } = await supabase
    .from('aml_violations')
    .insert({
      user_id: userId,
      rule_type: ruleType,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      actual_value: Math.round(actualHours * 100) / 100,
      limit_value: limitHours,
      notified: false,
    })
    .select('id')
    .single();

  if (error || !violation) {
    console.error('Kunne ikke opprette AML-brudd:', error);
    return;
  }

  const ruleLabels: Record<AmlRuleType, string> = {
    avg_day:     'gjennomsnittlig daglig arbeidstid',
    avg_week:    'gjennomsnittlig ukentlig arbeidstid',
    max_day:     'maks daglig arbeidstid',
    max_week:    'maks ukentlig arbeidstid',
    max_year:    'maks årlig arbeidstid',
    rest_daily:  'daglig hviletid',
    rest_weekly: 'ukentlig hviletid',
  };

  const label = ruleLabels[ruleType];
  const actualFormatted = actualHours.toFixed(1).replace('.', ',');
  const limitFormatted = limitHours.toFixed(1).replace('.', ',');
  const dateStr = windowEnd.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' });

  // Meldingstekst tilpasses retning på bruddet (for mye arbeid vs. for lite hvile)
  const isRestRule = ruleType === 'rest_daily' || ruleType === 'rest_weekly';
  const message = isRestRule
    ? `${userName} hadde for kort ${label} ${dateStr} (${actualFormatted} t / min ${limitFormatted} t)`
    : `${userName} overskred ${label} ${dateStr} (${actualFormatted} t / maks ${limitFormatted} t)`;

  await notifyTeamLeadersForUser(
    userId,
    'aml_violation',
    'Arbeidsmiljøbrudd oppdaget',
    message,
    violation.id,
    'aml_violation',
  );

  // Merk bruddet som varslet
  await supabase
    .from('aml_violations')
    .update({ notified: true })
    .eq('id', violation.id);
}

// --- Hovedfunksjoner ---

/**
 * Sjekker alle AML-regeltyper for én bruker mot gjeldende AML-regler.
 * Kalles asynkront etter godkjenning/endring av timer og av nattjobben.
 */
export async function checkAllViolations(userId: string): Promise<void> {
  const rules = await getAmlRules();
  if (!rules) return;

  const now = new Date();

  // Hent brukerens navn for varseltekst
  const { data: userRow } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single();
  const userName = (userRow as { name: string } | null)?.name ?? 'Ansatt';

  // Hent alle godkjente entries for brukeren (trenger hele historikken for ulike sjekker)
  const { data: allEntries } = await supabase
    .from('time_entries')
    .select('id, clock_in, clock_out')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .not('clock_out', 'is', null)
    .order('clock_in', { ascending: true });

  const entries = (allEntries ?? []) as { id: string; clock_in: string; clock_out: string }[];

  // ── max_day ────────────────────────────────────────────────────────────────
  if (rules.max_hours_per_day != null && !(await hasOpenViolation(userId, 'max_day'))) {
    let worstHours = 0;
    let worstEntry: { clock_in: string; clock_out: string } | null = null;

    for (const e of entries) {
      const hours = (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3_600_000;
      if (hours > worstHours) {
        worstHours = hours;
        worstEntry = e;
      }
    }

    if (worstEntry && worstHours > rules.max_hours_per_day) {
      await createViolationAndNotify(
        userId, userName, 'max_day',
        new Date(worstEntry.clock_in), new Date(worstEntry.clock_out),
        worstHours, rules.max_hours_per_day,
      );
    }
  }

  // ── max_week (verste rullerende 7-dagers vindu) ────────────────────────────
  if (rules.max_hours_per_week != null && !(await hasOpenViolation(userId, 'max_week'))) {
    let worstWeekHours = 0;
    let worstWeekStart: Date | null = null;
    let worstWeekEnd: Date | null = null;

    for (const anchor of entries) {
      const anchorDate = new Date(anchor.clock_in);
      anchorDate.setHours(0, 0, 0, 0);
      const windowEnd = new Date(anchorDate);
      windowEnd.setDate(windowEnd.getDate() + 7);

      let sum = 0;
      for (const e of entries) {
        const ci = new Date(e.clock_in);
        if (ci >= anchorDate && ci < windowEnd) {
          sum += (new Date(e.clock_out).getTime() - ci.getTime()) / 3_600_000;
        }
      }

      if (sum > worstWeekHours) {
        worstWeekHours = sum;
        worstWeekStart = anchorDate;
        worstWeekEnd = windowEnd;
      }
    }

    if (worstWeekStart && worstWeekEnd && worstWeekHours > rules.max_hours_per_week) {
      await createViolationAndNotify(
        userId, userName, 'max_week',
        worstWeekStart, worstWeekEnd,
        worstWeekHours, rules.max_hours_per_week,
      );
    }
  }

  // ── max_year (siste 365 dager) ─────────────────────────────────────────────
  if (rules.max_hours_per_year != null && !(await hasOpenViolation(userId, 'max_year'))) {
    const yearAgo = new Date(now);
    yearAgo.setDate(yearAgo.getDate() - 365);

    let yearHours = 0;
    for (const e of entries) {
      const ci = new Date(e.clock_in);
      if (ci >= yearAgo) {
        yearHours += (new Date(e.clock_out).getTime() - ci.getTime()) / 3_600_000;
      }
    }

    if (yearHours > rules.max_hours_per_year) {
      await createViolationAndNotify(
        userId, userName, 'max_year',
        yearAgo, now,
        yearHours, rules.max_hours_per_year,
      );
    }
  }

  // ── avg_day og avg_week (rullerende vindu) ─────────────────────────────────
  if (rules.avg_calculation_weeks != null) {
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - rules.avg_calculation_weeks * 7);

    let totalHoursAvg = 0;
    for (const e of entries) {
      const ci = new Date(e.clock_in);
      if (ci >= windowStart && ci <= now) {
        totalHoursAvg += (new Date(e.clock_out).getTime() - ci.getTime()) / 3_600_000;
      }
    }

    if (totalHoursAvg > 0) {
      // avg_day
      if (rules.avg_max_hours_per_day != null && !(await hasOpenViolation(userId, 'avg_day'))) {
        const workdays = countCalendarWorkdays(windowStart, now);
        if (workdays > 0) {
          const avgDay = totalHoursAvg / workdays;
          if (avgDay > rules.avg_max_hours_per_day) {
            await createViolationAndNotify(
              userId, userName, 'avg_day',
              windowStart, now,
              avgDay, rules.avg_max_hours_per_day,
            );
          }
        }
      }

      // avg_week
      if (rules.avg_max_hours_per_week != null && !(await hasOpenViolation(userId, 'avg_week'))) {
        const avgWeek = totalHoursAvg / rules.avg_calculation_weeks;
        if (avgWeek > rules.avg_max_hours_per_week) {
          await createViolationAndNotify(
            userId, userName, 'avg_week',
            windowStart, now,
            avgWeek, rules.avg_max_hours_per_week,
          );
        }
      }
    }
  }

  // ── rest_daily (korteste pause mellom to påfølgende stemplinger) ───────────
  if (rules.min_daily_rest_hours != null && !(await hasOpenViolation(userId, 'rest_daily'))) {
    let shortestRestHours = Infinity;
    let worstGapStart: Date | null = null;
    let worstGapEnd: Date | null = null;

    for (let i = 0; i < entries.length - 1; i++) {
      const gapStart = new Date(entries[i].clock_out);
      const gapEnd = new Date(entries[i + 1].clock_in);
      const restHours = (gapEnd.getTime() - gapStart.getTime()) / 3_600_000;

      // Utelukk negative gaps (overlappende stemplinger) og trivielle pauser intradag (< 1 minutt)
      if (restHours < 1 / 60) continue;

      if (restHours < shortestRestHours) {
        shortestRestHours = restHours;
        worstGapStart = gapStart;
        worstGapEnd = gapEnd;
      }
    }

    if (worstGapStart && worstGapEnd && shortestRestHours < rules.min_daily_rest_hours) {
      await createViolationAndNotify(
        userId, userName, 'rest_daily',
        worstGapStart, worstGapEnd,
        shortestRestHours, rules.min_daily_rest_hours,
      );
    }
  }

  // ── rest_weekly (lengste sammenhengende hvile per ISO-uke) ─────────────────
  if (rules.min_weekly_rest_hours != null && !(await hasOpenViolation(userId, 'rest_weekly'))) {
    // Grupper entries per ISO-uke (mandag = start)
    const byWeek = new Map<string, typeof entries>();
    for (const e of entries) {
      const d = new Date(e.clock_in);
      // Finn mandag i uken
      const day = d.getDay(); // 0=søn, 1=man, ..., 6=lør
      const diffToMonday = (day === 0 ? -6 : 1 - day);
      const monday = new Date(d);
      monday.setDate(d.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const key = monday.toISOString();
      if (!byWeek.has(key)) byWeek.set(key, []);
      byWeek.get(key)!.push(e);
    }

    let shortestMaxRest = Infinity;
    let worstWeekStart: Date | null = null;
    let worstWeekEnd: Date | null = null;

    for (const [mondayIso, weekEntries] of byWeek) {
      const monday = new Date(mondayIso);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7); // søndag 00:00 neste uke = grensen

      // Sorter kronologisk (bør allerede være det, men sikrer)
      const sorted = [...weekEntries].sort(
        (a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime(),
      );

      // Bygg gap-liste: [uke-start → første clock_in] + [clock_out → neste clock_in] + [siste clock_out → uke-slutt]
      const gaps: { from: Date; to: Date }[] = [];

      // Gap fra mandag 00:00 til første stempling
      gaps.push({ from: monday, to: new Date(sorted[0].clock_in) });

      // Gap mellom stemplinger
      for (let i = 0; i < sorted.length - 1; i++) {
        gaps.push({
          from: new Date(sorted[i].clock_out),
          to: new Date(sorted[i + 1].clock_in),
        });
      }

      // Gap fra siste stempling til søndag 00:00
      gaps.push({ from: new Date(sorted[sorted.length - 1].clock_out), to: sunday });

      // Lengste sammenhengende hvile i denne uken
      let maxRest = 0;
      for (const gap of gaps) {
        const h = (gap.to.getTime() - gap.from.getTime()) / 3_600_000;
        if (h > maxRest) maxRest = h;
      }

      if (maxRest < shortestMaxRest) {
        shortestMaxRest = maxRest;
        worstWeekStart = monday;
        worstWeekEnd = sunday;
      }
    }

    if (worstWeekStart && worstWeekEnd && shortestMaxRest < rules.min_weekly_rest_hours) {
      await createViolationAndNotify(
        userId, userName, 'rest_weekly',
        worstWeekStart, worstWeekEnd,
        shortestMaxRest, rules.min_weekly_rest_hours,
      );
    }
  }
}

/**
 * Kjører checkAllViolations for alle aktive brukere.
 * Brukes av den nattlige cron-jobben.
 */
export async function checkAllViolationsAllUsers(): Promise<void> {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('is_active', true);

  if (!users || users.length === 0) return;

  for (const u of users as { id: string }[]) {
    await checkAllViolations(u.id);
  }
}

/**
 * Returnerer AML-brudd for lederens/faglederens team de siste N dagene.
 * Joinér brukerinfo for visning i frontend.
 */
export async function listViolationsForLeader(
  departmentId: string | null,
  groupId: string | null,
  days: number,
): Promise<(AmlViolation & { user: { name: string; employee_number: string } })[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Finn relevante bruker-IDer basert på leder/fagleder-tilknytning
  let userQuery = supabase.from('users').select('id').eq('is_active', true);
  if (groupId)           userQuery = userQuery.eq('group_id', groupId);
  else if (departmentId) userQuery = userQuery.eq('department_id', departmentId);

  const { data: teamUsers } = await userQuery;
  if (!teamUsers || teamUsers.length === 0) return [];

  const userIds = (teamUsers as { id: string }[]).map((u) => u.id);

  const { data, error } = await supabase
    .from('aml_violations')
    .select('*, user:users!aml_violations_user_id_fkey(name, employee_number)')
    .in('user_id', userIds)
    .gte('violated_at', since.toISOString())
    .order('violated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as (AmlViolation & { user: { name: string; employee_number: string } })[];
}
