import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/absence.service.js';
import { badRequest } from '../utils/errors.js';

const router = Router();

// --- Fraværskoder ---

router.get(
  '/codes',
  asyncHandler(async (req, res) => {
    const activeOnly = req.user.role !== 'admin';
    const codes = await service.listAbsenceCodes(activeOnly);
    res.json({ data: codes });
  }),
);

router.post(
  '/codes',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const code = await service.createAbsenceCode(req.body);
    res.status(201).json({ data: code });
  }),
);

router.patch(
  '/codes/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const code = await service.updateAbsenceCode(req.params.id, req.body);
    res.json({ data: code });
  }),
);

// --- Fraværssøknader ---

router.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const { status, from, to } = req.query as Record<string, string>;
    const user = req.user;
    const dateOptions = { dateFrom: from, dateTo: to };

    const mine = req.query['mine'] === 'true';

    let requests;
    if (mine || user.role === 'ansatt') {
      requests = await service.listAbsenceRequests({ userId: user.id, status, ...dateOptions });
    } else if (user.role === 'leder') {
      requests = await service.listAbsenceRequests({
        departmentId: user.department_id ?? undefined,
        status,
        ...dateOptions,
      });
    } else {
      requests = await service.listAbsenceRequests({ status, isAdmin: true, ...dateOptions });
    }

    res.json({ data: requests });
  }),
);

router.post(
  '/requests',
  asyncHandler(async (req, res) => {
    const request = await service.createAbsenceRequest(req.user.id, req.body);
    res.status(201).json({ data: request });
  }),
);

router.patch(
  '/requests/:id',
  asyncHandler(async (req, res) => {
    const { hours_per_day, comment } = req.body;
    const patch: { hours_per_day?: number | null; comment?: string | null } = {};
    if (hours_per_day !== undefined) patch.hours_per_day = hours_per_day;
    if (comment !== undefined) patch.comment = comment;
    const request = await service.updateAbsenceRequest(req.params.id, req.user.id, patch);
    res.json({ data: request });
  }),
);

router.delete(
  '/requests/:id',
  asyncHandler(async (req, res) => {
    await service.deleteAbsenceRequest(req.params.id, req.user.id);
    res.status(204).send();
  }),
);

router.post(
  '/requests/:id/approve',
  requireRole(['leder', 'admin']),
  asyncHandler(async (req, res) => {
    const request = await service.approveAbsenceRequest(req.params.id, req.user.id);
    res.json({ data: request });
  }),
);

router.post(
  '/requests/:id/reject',
  requireRole(['leder', 'admin']),
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason) throw badRequest('Begrunnelse er påkrevd');
    const request = await service.rejectAbsenceRequest(req.params.id, req.user.id, reason);
    res.json({ data: request });
  }),
);

export default router;
