import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/user.service.js';

const router = Router();

// Liste over grupper (admin og leder)
router.get(
  '/',
  requireRole(['admin', 'leder']),
  asyncHandler(async (req, res) => {
    const { department_id } = req.query as Record<string, string>;
    const groups = await service.listGroups(department_id);
    res.json({ data: groups });
  }),
);

// Opprett gruppe (admin)
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const group = await service.createGroup(req.body);
    res.status(201).json({ data: group });
  }),
);

// Oppdater gruppe (admin)
router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const group = await service.updateGroup(req.params.id, req.body);
    res.json({ data: group });
  }),
);

// Slett gruppe (admin)
router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await service.deleteGroup(req.params.id);
    res.status(204).send();
  }),
);

export default router;
