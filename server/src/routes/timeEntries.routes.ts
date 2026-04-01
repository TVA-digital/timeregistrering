import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/timeEntry.service.js';
import { badRequest } from '../utils/errors.js';

const router = Router();

// Liste over timer
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, from, to } = req.query as Record<string, string>;
    const user = req.user;

    const mine = req.query['mine'] === 'true';

    let entries;
    if (mine || user.role === 'ansatt') {
      entries = await service.listEntries({ userId: user.id, status, from, to });
    } else if (user.role === 'leder') {
      entries = await service.listEntries({
        departmentId: user.department_id ?? undefined,
        status,
        from,
        to,
      });
    } else {
      // admin + lonningsansvarlig ser alle
      entries = await service.listEntries({ status, from, to, isAdmin: true });
    }

    res.json({ data: entries });
  }),
);

// Aktiv innstempeling
router.get(
  '/active',
  asyncHandler(async (req, res) => {
    const entry = await service.getActiveEntry(req.user.id);
    res.json({ data: entry });
  }),
);

// Stempl inn
router.post(
  '/clock-in',
  asyncHandler(async (req, res) => {
    const { comment } = req.body;
    const entry = await service.clockIn(req.user.id, comment);
    res.status(201).json({ data: entry });
  }),
);

// Send inn alle utkast for en måned
router.post(
  '/submit-month',
  asyncHandler(async (req, res) => {
    const { year_month } = req.body;
    const ym: string = typeof year_month === 'string' && /^\d{4}-\d{2}$/.test(year_month)
      ? year_month
      : new Date().toISOString().slice(0, 7); // default: inneværende måned
    const result = await service.submitMonth(req.user.id, ym);
    res.json({ data: result });
  }),
);

// Stempl ut
router.post(
  '/:id/clock-out',
  asyncHandler(async (req, res) => {
    const { comment, absence_code_id } = req.body;
    const entry = await service.clockOut(
      req.params.id,
      req.user.id,
      comment,
      absence_code_id,
    );
    res.json({ data: entry });
  }),
);

// Oppdater tidspunkter og/eller kommentar (kun utkast)
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { clock_in, clock_out, comment } = req.body;
    const patch: { clock_in?: string; clock_out?: string; comment?: string } = {};
    if (clock_in !== undefined) patch.clock_in = clock_in;
    if (clock_out !== undefined) patch.clock_out = clock_out;
    if (comment !== undefined) patch.comment = comment;
    if (Object.keys(patch).length === 0) throw badRequest('Ingen felter å oppdatere');
    const entry = await service.updateEntry(req.params.id, req.user.id, patch);
    res.json({ data: entry });
  }),
);

// Send inn for godkjenning
router.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const entry = await service.submitEntry(req.params.id, req.user.id);
    res.json({ data: entry });
  }),
);

// Godkjenn (leder/admin)
router.post(
  '/:id/approve',
  requireRole(['leder', 'admin']),
  asyncHandler(async (req, res) => {
    const entry = await service.approveEntry(req.params.id, req.user.id);
    res.json({ data: entry });
  }),
);

// Korriger godkjent stempling (leder/admin) — oppdaterer tidspunkter, reberegner flex og kjører AML
router.patch(
  '/:id/admin-edit',
  requireRole(['leder', 'admin']),
  asyncHandler(async (req, res) => {
    const { clock_in, clock_out } = req.body;
    if (!clock_in && !clock_out) throw badRequest('clock_in eller clock_out må oppgis');
    const patch: { clock_in?: string; clock_out?: string } = {};
    if (clock_in)  patch.clock_in  = clock_in;
    if (clock_out) patch.clock_out = clock_out;
    const entry = await service.adminUpdateEntry(req.params.id, patch, req.user.id);
    res.json({ data: entry });
  }),
);

// Avvis (leder/admin)
router.post(
  '/:id/reject',
  requireRole(['leder', 'admin']),
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason) throw badRequest('Begrunnelse er påkrevd');
    const entry = await service.rejectEntry(req.params.id, req.user.id, reason);
    res.json({ data: entry });
  }),
);

// Slett (kun egne utkast, eller admin)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.deleteEntry(req.params.id, req.user.id, req.user.role === 'admin');
    res.status(204).send();
  }),
);

export default router;
