import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import * as service from '../services/payroll.service.js';
import { badRequest } from '../utils/errors.js';

const router = Router();

router.get(
  '/export',
  requireRole(['lonningsansvarlig', 'admin']),
  asyncHandler(async (req, res) => {
    const { from, to, format } = req.query as Record<string, string>;

    if (!from || !to) throw badRequest('Fra- og til-dato er påkrevd');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw badRequest('Datoformat må være YYYY-MM-DD');
    }

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
    const { from, to } = req.query as Record<string, string>;
    if (!from || !to) throw badRequest('Fra- og til-dato er påkrevd');
    const rows = await service.aggregatePayrollData(from, to);
    res.json({ data: rows });
  }),
);

export default router;
