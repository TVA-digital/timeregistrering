import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as service from '../services/flex.service.js';
import { forbidden } from '../utils/errors.js';
import { assertCanViewUser } from '../utils/authz.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const targetUserId = req.query['user_id'] as string | undefined;
    if (targetUserId) {
      if (!['leder', 'admin', 'fagleder'].includes(req.user.role)) throw forbidden();
      await assertCanViewUser(req.user, targetUserId);
      const balance = await service.getFlexBalance(targetUserId);
      return res.json({ data: balance });
    }
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
