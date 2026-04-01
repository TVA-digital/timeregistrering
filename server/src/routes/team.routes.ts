import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { getTeamStatus } from '../services/team.service.js';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const router = Router();

// Teamstatus — for leder, admin og fagleder
router.get(
  '/status',
  requireRole(['leder', 'admin', 'fagleder']),
  asyncHandler(async (req, res) => {
    const today = new Date();
    const { from, to } = req.query as Record<string, string>;
    const fromDate = from ?? format(startOfMonth(today), 'yyyy-MM-dd');
    const toDate = to ?? format(endOfMonth(today), 'yyyy-MM-dd');

    const isAdmin    = req.user.role === 'admin';
    const isFagleder = req.user.role === 'fagleder';

    // Fagleder ser kun sin gruppe; leder ser sin avdeling; admin ser alle
    const departmentId = (!isAdmin && !isFagleder) ? (req.user.department_id ?? null) : null;
    const groupId      = isFagleder ? ((req.user as { group_id?: string | null }).group_id ?? null) : null;

    const result = await getTeamStatus(departmentId, groupId, fromDate, toDate);
    res.json({ data: result });
  }),
);

export default router;
