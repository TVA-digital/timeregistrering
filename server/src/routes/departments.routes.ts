import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/user.service.js';
import { badRequest } from '../utils/errors.js';
import { departmentNameSchema } from '../utils/validators.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const departments = await service.listDepartments();
    res.json({ data: departments });
  }),
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name } = departmentNameSchema.parse(req.body);
    const dept = await service.createDepartment(name);
    res.status(201).json({ data: dept });
  }),
);

router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name } = departmentNameSchema.parse(req.body);
    const dept = await service.updateDepartment(req.params.id, name);
    res.json({ data: dept });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await service.deleteDepartment(req.params.id);
    res.status(204).send();
  }),
);

export default router;
