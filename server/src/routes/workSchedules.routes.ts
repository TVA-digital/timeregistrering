import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/workSchedule.service.js';
import { badRequest } from '../utils/errors.js';

const router = Router();

// Hent alle arbeidsplanmaler
router.get(
  '/',
  requireRole(['admin', 'leder']),
  asyncHandler(async (_req, res) => {
    const schedules = await service.listAllSchedules();
    res.json({ data: schedules });
  }),
);

// Hent tilordninger for en bruker (admin/leder)
router.get(
  '/assignments',
  requireRole(['admin', 'leder']),
  asyncHandler(async (req, res) => {
    const { userId } = req.query as { userId?: string };
    if (!userId) throw badRequest('userId er påkrevd');
    const assignments = await service.listSchedulesForUser(userId);
    res.json({ data: assignments });
  }),
);

// Hent egne tilordninger (alle autentiserte)
router.get(
  '/my',
  asyncHandler(async (req, res) => {
    const assignments = await service.listSchedulesForUser(req.user.id);
    res.json({ data: assignments });
  }),
);

// Opprett ny arbeidsplanmal (admin)
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const schedule = await service.createSchedule(req.body);
    res.status(201).json({ data: schedule });
  }),
);

// Tilordne arbeidsplan til bruker (admin)
router.post(
  '/assignments',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const assignment = await service.assignScheduleToUser(req.body);
    res.status(201).json({ data: assignment });
  }),
);

export default router;
