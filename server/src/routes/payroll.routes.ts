import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/payroll.service.js';
import { badRequest } from '../utils/errors.js';
import { dateRangeQuery } from '../utils/validators.js';

const router = Router();

router.get(
  '/export',
  requireRole(['lonningsansvarlig', 'admin']),
  asyncHandler(async (req, res) => {
    const { format } = req.query as Record<string, string>;
    const { from, to } = dateRangeQuery.parse(req.query);

    if (!from || !to) throw badRequest('Fra- og til-dato er påkrevd');

    const rows = await service.aggregatePayrollData(from, to);
    const exportFormat = format === 'csv' ? 'csv' : 'xlsx';

    if (exportFormat === 'csv') {
      const csv = service.exportToCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="lonnseksport-${from}-${to}.csv"`);
      res.send('\uFEFF' + csv); // UTF-8 BOM for norsk Excel
      return;
    }

    const buffer = await service.exportToXlsx(rows, from, to);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lonnseksport-${from}-${to}.xlsx"`,
    );
    res.send(buffer);
  }),
);

// Forhåndsvisning (JSON) for UI-tabellen
router.get(
  '/preview',
  requireRole(['lonningsansvarlig', 'admin']),
  asyncHandler(async (req, res) => {
    const { from, to } = dateRangeQuery.parse(req.query);
    if (!from || !to) throw badRequest('Fra- og til-dato er påkrevd');
    const rows = await service.aggregatePayrollData(from, to);
    res.json({ data: rows });
  }),
);

export default router;
