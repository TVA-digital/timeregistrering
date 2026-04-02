import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/user.service.js';
import { createUserSchema, updateUserSchema } from '../utils/validators.js';
import { assertCanViewUser } from '../utils/authz.js';
import { forbidden } from '../utils/errors.js';
import { setFlexBalance } from '../services/flex.service.js';
import { setVacationBalance } from '../services/vacation.service.js';

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

// Hent enkeltbruker (leder/admin/fagleder kan se brukere de har tilgang til)
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const viewer = req.user;
    if (!['leder', 'admin', 'fagleder'].includes(viewer.role)) throw forbidden();
    await assertCanViewUser(viewer, req.params.id);
    const user = await service.getUserById(req.params.id);
    res.json({ data: user });
  }),
);

// Admin-overstyring av fleksitids- og feriesaldo
router.patch(
  '/:id/balances',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { flex_minutes, vacation_days } = req.body;
    if (typeof flex_minutes === 'number') await setFlexBalance(req.params.id, flex_minutes);
    if (typeof vacation_days === 'number') await setVacationBalance(req.params.id, vacation_days);
    res.json({ data: { ok: true } });
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
