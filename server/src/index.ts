import 'dotenv/config';
import cron from 'node-cron';
import { config } from './config.js';
import { createApp } from './app.js';
import { preloadHolidayCache } from './utils/norwegianHolidays.js';
import { checkAllViolationsAllUsers } from './services/aml.service.js';

const app = createApp();

// Forhåndsberegn norske helligdager ved oppstart
preloadHolidayCache();

// Nattlig AML-sjekk kl. 02:00 — fanger opp rullerende vinduer som kan ha forskjøvet seg
cron.schedule('0 2 * * *', () => {
  console.log('Kjører nattlig AML-sjekk...');
  checkAllViolationsAllUsers().catch((err) =>
    console.error('Nattlig AML-sjekk feilet:', err),
  );
});

app.listen(config.PORT, () => {
  console.log(`Timeregistrering API kjører på port ${config.PORT} (${config.NODE_ENV})`);
});
