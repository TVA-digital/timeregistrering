import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import timeEntriesRouter from './timeEntries.routes.js';
import absenceRouter from './absence.routes.js';
import overtimeRulesRouter from './overtimeRules.routes.js';
import workSchedulesRouter from './workSchedules.routes.js';
import usersRouter from './users.routes.js';
import departmentsRouter from './departments.routes.js';
import flexBalanceRouter from './flexBalance.routes.js';
import notificationsRouter from './notifications.routes.js';
import payrollRouter from './payroll.routes.js';
import absencePeriodsRouter from './absencePeriods.routes.js';
import teamRouter from './team.routes.js';
import groupsRouter from './groups.routes.js';
import amlRouter from './aml.routes.js';

const router = Router();

// Alle API-ruter krever autentisering
router.use(authenticate);

router.use('/time-entries', timeEntriesRouter);
router.use('/absence', absenceRouter);
router.use('/overtime-rules', overtimeRulesRouter);
router.use('/work-schedules', workSchedulesRouter);
router.use('/users', usersRouter);
router.use('/departments', departmentsRouter);
router.use('/flex-balance', flexBalanceRouter);
router.use('/notifications', notificationsRouter);
router.use('/payroll', payrollRouter);
router.use('/absence-periods', absencePeriodsRouter);
router.use('/team', teamRouter);
router.use('/groups', groupsRouter);
router.use('/aml', amlRouter);

export default router;
