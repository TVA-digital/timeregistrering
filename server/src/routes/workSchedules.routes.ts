import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/workSchedule.service.js';
import { badRequest, forbidden } from '../utils/errors.js';
import { getUserById } from '../services/user.service.js';
import { createScheduleSchema, createAssignmentSchema } from '../utils/validators.js';

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
    // Leder kan bare se tilordninger for brukere i egen avdeling
    if (req.user.role === 'leder') {
      const target = await getUserById(userId);
      if (target.department_id !== req.user.department_id) throw forbidden();
    }
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
    const body = createScheduleSchema.parse(req.body);
    const schedule = await service.createSchedule(body);
    res.status(201).json({ data: schedule });
  }),
);

// Tilordne arbeidsplan til bruker (admin)
router.post(
  '/assignments',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = createAssignmentSchema.parse(req.body);
    const assignment = await service.assignScheduleToUser(body);
    res.status(201).json({ data: assignment });
  }),
);

export default router;
