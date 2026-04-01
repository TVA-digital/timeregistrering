import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as service from '../services/flex.service.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const balance = await service.getFlexBalance(req.user.id);
    res.json({ data: balance });
  }),
);

router.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const transactions = await service.getFlexTransactions(req.user.id);
    res.json({ data: transactions });
  }),
);

export default router;
