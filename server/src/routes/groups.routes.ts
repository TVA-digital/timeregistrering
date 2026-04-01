import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/user.service.js';
import { createGroupSchema, updateGroupSchema } from '../utils/validators.js';

const router = Router();

// Liste over grupper (admin og leder)
router.get(
  '/',
  requireRole(['admin', 'leder']),
  asyncHandler(async (req, res) => {
    // Leder kan bare se grupper i egen avdeling
    const deptId = req.user.role === 'leder'
      ? (req.user.department_id ?? undefined)
      : (req.query as Record<string, string>).department_id;
    const groups = await service.listGroups(deptId);
    res.json({ data: groups });
  }),
);

// Opprett gruppe (admin)
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = createGroupSchema.parse(req.body);
    const group = await service.createGroup(body);
    res.status(201).json({ data: group });
  }),
);

// Oppdater gruppe (admin)
router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = updateGroupSchema.parse(req.body);
    const group = await service.updateGroup(req.params.id, body);
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
