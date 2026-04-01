import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { supabase } from '../services/supabase.js';
import { listViolationsForLeader } from '../services/aml.service.js';
import { amlRuleSchema } from '../utils/validators.js';

const router = Router();

// Hent gjeldende AML-regler (første rad, eller null om ingen er satt)
router.get(
  '/rules',
  requireRole(['admin', 'leder', 'fagleder']),
  asyncHandler(async (_req, res) => {
    const { data } = await supabase.from('aml_rules').select('*').limit(1).single();
    res.json({ data: data ?? null });
  }),
);

// Lagre AML-regler — upsert (admin only)
router.put(
  '/rules',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = amlRuleSchema.parse(req.body);
    const { data: existing } = await supabase.from('aml_rules').select('id').limit(1).single();

    let result;
    if (existing?.id) {
      const { data, error } = await supabase
        .from('aml_rules')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('aml_rules')
        .insert(body)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json({ data: result });
  }),
);

// AML-brudd for lederens/faglederens team — siste N dager (default 30)
router.get(
  '/violations',
  requireRole(['leder', 'admin', 'fagleder']),
  asyncHandler(async (req, res) => {
    const days = Math.min(Number(req.query['days'] ?? 30), 365);
    const isAdmin    = req.user.role === 'admin';
    const isFagleder = req.user.role === 'fagleder';

    // Fagleder ser kun sin gruppe; leder ser sin avdeling; admin ser alle
    const departmentId = (!isAdmin && !isFagleder) ? (req.user.department_id ?? null) : null;
    const groupId      = isFagleder ? ((req.user as { group_id?: string | null }).group_id ?? null) : null;

    const violations = await listViolationsForLeader(departmentId, groupId, days);
    res.json({ data: violations });
  }),
);

export default router;
