// Norske offentlige helligdager — faste + bevegelige (påskebaserte)
// Bruker Meeus/Jones/Butcher-algoritmen for påskedato

function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-indeksert
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getNorwegianHolidays(year: number): Set<string> {
  const easter = getEasterDate(year);

  return new Set<string>([
    // Faste helligdager
    `${year}-01-01`, // Nyttårsdag
    `${year}-05-01`, // Arbeidernes dag
    `${year}-05-17`, // Grunnlovsdag
    `${year}-12-25`, // Første juledag
    `${year}-12-26`, // Andre juledag

    // Bevegelige helligdager (påskebaserte)
    toISODate(addDays(easter, -3)), // Skjærtorsdag
    toISODate(addDays(easter, -2)), // Langfredag
    toISODate(easter), // Første påskedag
    toISODate(addDays(easter, 1)), // Andre påskedag
    toISODate(addDays(easter, 39)), // Kristi himmelfartsdag
    toISODate(addDays(easter, 49)), // Første pinsedag
    toISODate(addDays(easter, 50)), // Andre pinsedag
  ]);
}

// Cache: forhåndsberegner for år-1 til år+2
const holidayCache = new Map<number, Set<string>>();

function ensureCached(year: number): void {
  if (!holidayCache.has(year)) {
    holidayCache.set(year, getNorwegianHolidays(year));
  }
}

// Kall ved serverstart for å fylle cache
export function preloadHolidayCache(): void {
  const year = new Date().getFullYear();
  for (let y = year - 1; y <= year + 2; y++) {
    ensureCached(y);
  }
}

export function isNorwegianHoliday(date: Date): boolean {
  const year = date.getFullYear();
  ensureCached(year);
  return holidayCache.get(year)!.has(toISODate(date));
}
