import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as service from '../services/notification.service.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unread === 'true';
    const notifications = await service.listNotifications(req.user.id, unreadOnly);
    res.json({ data: notifications });
  }),
);

router.get(
  '/count',
  asyncHandler(async (req, res) => {
    const count = await service.getUnreadCount(req.user.id);
    res.json({ data: { count } });
  }),
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await service.markAsRead(req.params.id, req.user.id);
    res.status(204).send();
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await service.markAllAsRead(req.user.id);
    res.status(204).send();
  }),
);

export default router;
