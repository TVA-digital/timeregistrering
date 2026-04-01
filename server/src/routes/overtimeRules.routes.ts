import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { supabase } from '../services/supabase.js';
import { notFound } from '../utils/errors.js';
import { createOvertimeRuleSchema, updateOvertimeRuleSchema } from '../utils/validators.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const showAll = req.user.role === 'admin';
    let query = supabase.from('overtime_rules').select('*').order('priority');
    if (!showAll) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data: data ?? [] });
  }),
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = createOvertimeRuleSchema.parse(req.body);
    const { data, error } = await supabase
      .from('overtime_rules')
      .insert(body)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  }),
);

router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = updateOvertimeRuleSchema.parse(req.body);
    const { data, error } = await supabase
      .from('overtime_rules')
      .update(body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) throw notFound('Overtidsregel');
    res.json({ data });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    // Deaktiver i stedet for å slette (bevarer historikk)
    await supabase
      .from('overtime_rules')
      .update({ is_active: false })
      .eq('id', req.params.id);
    res.status(204).send();
  }),
);

export default router;
