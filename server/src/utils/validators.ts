import { z } from 'zod';

// ── Helpers ──────────────────────────────────────────
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Må være YYYY-MM-DD').refine(
  (s) => !isNaN(Date.parse(s)),
  'Ugyldig dato',
);

const isoDatetime = z.string().refine(
  (s) => !isNaN(Date.parse(s)),
  'Ugyldig tidspunkt',
);

const uuid = z.string().uuid('Ugyldig UUID');

// ── AML ──────────────────────────────────────────────
export const amlRuleSchema = z.object({
  rule_type: z.enum(['max_day', 'max_week', 'max_year', 'rest_daily', 'rest_weekly', 'avg_day', 'avg_week']),
  threshold_value: z.number().positive(),
  window_days: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

// ── Users ────────────────────────────────────────────
export const createUserSchema = z.object({
  employee_number: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  email: z.string().email('Ugyldig e-postadresse'),
  password: z.string().min(6),
  role: z.enum(['ansatt', 'leder', 'admin', 'lonningsansvarlig', 'fagleder']),
  department_id: uuid.nullable().optional(),
  group_id: uuid.nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(['ansatt', 'leder', 'admin', 'lonningsansvarlig', 'fagleder']).optional(),
  department_id: uuid.nullable().optional(),
  group_id: uuid.nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, 'Minst ett felt må oppgis');

// ── Overtime Rules ───────────────────────────────────
export const createOvertimeRuleSchema = z.object({
  name: z.string().min(1).max(100),
  threshold_minutes: z.number().int().nonnegative(),
  multiplier: z.number().positive(),
  priority: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export const updateOvertimeRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  threshold_minutes: z.number().int().nonnegative().optional(),
  multiplier: z.number().positive().optional(),
  priority: z.number().int().optional(),
  is_active: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, 'Minst ett felt må oppgis');

// ── Absence Codes ────────────────────────────────────
export const createAbsenceCodeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  requires_approval: z.boolean().default(false),
  deducts_flex: z.boolean().default(false),
  deducts_vacation: z.boolean().default(false),
  allow_clock_out: z.boolean().optional(),
  adds_flex: z.boolean().optional(),
  is_quick_select: z.boolean().optional(),
});

export const updateAbsenceCodeSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  requires_approval: z.boolean().optional(),
  deducts_flex: z.boolean().optional(),
  deducts_vacation: z.boolean().optional(),
  allow_clock_out: z.boolean().optional(),
  adds_flex: z.boolean().optional(),
  is_active: z.boolean().optional(),
  is_quick_select: z.boolean().optional(),
});

// ── Absence Requests ─────────────────────────────────
export const updateAbsenceRequestSchema = z.object({
  hours_per_day: z.number().positive().optional(),
  comment: z.string().max(500).optional(),
}).refine((d) => Object.keys(d).length > 0, 'Minst ett felt må oppgis');

// ── Absence Periods ──────────────────────────────────
export const updateAbsencePeriodSchema = z.object({
  started_at: isoDatetime.optional(),
  ended_at: isoDatetime.optional(),
}).refine((d) => d.started_at || d.ended_at, 'Minst ett felt må oppgis')
  .refine(
    (d) => !(d.started_at && d.ended_at && new Date(d.ended_at) < new Date(d.started_at)),
    'ended_at kan ikke være før started_at',
  );

// ── Departments ──────────────────────────────────────
export const departmentNameSchema = z.object({
  name: z.string().min(1).max(100),
});

// ── Groups ───────────────────────────────────────────
export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  department_id: uuid,
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  department_id: uuid.optional(),
}).refine((d) => Object.keys(d).length > 0, 'Minst ett felt må oppgis');

// ── Work Schedules ───────────────────────────────────
export const createScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  days: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    hours: z.number().nonnegative().max(24),
  })).min(1).max(7),
});

export const createAssignmentSchema = z.object({
  user_id: uuid,
  schedule_id: uuid,
  effective_from: isoDate,
});

// ── Query date helpers ───────────────────────────────
export const dateRangeQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
}).refine(
  (d) => !(d.from && d.to && d.from > d.to),
  'from kan ikke være etter to',
);
