const BOGOTA_TIME_ZONE = 'America/Bogota';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function todayInBogota(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function parseBusinessDate(value: string): Date {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`Invalid business date: ${value}`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid business date: ${value}`);
  }
  return date;
}

export function formatBusinessDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
