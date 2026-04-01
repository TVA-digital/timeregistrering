import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as service from '../services/absencePeriod.service.js';
import { badRequest } from '../utils/errors.js';
import { updateAbsencePeriodSchema } from '../utils/validators.js';

const router = Router();

// Hent fraværsperioder for en periode
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string>;
    const periods = await service.listAbsencePeriods(
      req.user.id,
      from ?? new Date().toISOString().slice(0, 10),
      to ?? new Date().toISOString().slice(0, 10),
    );
    res.json({ data: periods });
  }),
);

// Hent aktiv fraværsperiode for innlogget bruker
router.get(
  '/active',
  asyncHandler(async (req, res) => {
    const period = await service.getActiveAbsencePeriod(req.user.id);
    res.json({ data: period });
  }),
);

// Avslutt fraværsperiode
router.post(
  '/:id/end',
  asyncHandler(async (req, res) => {
    const { return_to_work } = req.body;
    if (typeof return_to_work !== 'boolean') {
      throw badRequest('return_to_work (boolean) er påkrevd');
    }
    const result = await service.endAbsencePeriod(req.params.id, req.user.id, return_to_work);
    res.json({ data: result });
  }),
);

// Oppdater tidspunkter for en fraværsperiode
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateAbsencePeriodSchema.parse(req.body);
    const patch: { started_at?: string; ended_at?: string } = {};
    if (body.started_at !== undefined) patch.started_at = body.started_at;
    if (body.ended_at !== undefined) patch.ended_at = body.ended_at;
    const period = await service.updateAbsencePeriod(req.params.id, req.user.id, patch);
    res.json({ data: period });
  }),
);

// Slett fraværsperiode
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.deleteAbsencePeriod(req.params.id, req.user.id);
    res.status(204).send();
  }),
);

export default router;
