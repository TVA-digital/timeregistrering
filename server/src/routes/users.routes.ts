import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/user.service.js';
import { createUserSchema, updateUserSchema } from '../utils/validators.js';

const router = Router();

// Hent innlogget bruker
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json({ data: req.user });
  }),
);

// Liste over brukere (leder ser avdeling, admin ser alle)
router.get(
  '/',
  requireRole(['admin', 'leder']),
  asyncHandler(async (req, res) => {
    const deptId =
      req.user.role === 'leder' ? (req.user.department_id ?? undefined) : undefined;
    const users = await service.listUsers(deptId);
    res.json({ data: users });
  }),
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);
    const user = await service.createUser(body);
    res.status(201).json({ data: user });
  }),
);

router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = updateUserSchema.parse(req.body);
    const user = await service.updateUser(req.params.id, body);
    res.json({ data: user });
  }),
);

// Synkroniser brukerprofil etter første innlogging
router.post(
  '/sync',
  asyncHandler(async (req, res) => {
    // Auth-trigger oppretter flex_balance automatisk
    // Denne ruten returnerer bare gjeldende profil
    res.json({ data: req.user });
  }),
);

export default router;
