// Konverter JS-ukedag (0=Søn) til norsk konvensjon (0=Man, 6=Søn)
export function jsWeekdayToNorwegian(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Formater minutter som "X t Y min" på norsk
export function formatMinutes(minutes: number): string {
  const isNegative = minutes < 0;
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const result = h > 0 ? `${h} t ${m > 0 ? m + ' min' : ''}`.trim() : `${m} min`;
  return isNegative ? `-${result}` : result;
}
