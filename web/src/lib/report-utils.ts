export interface ReportRange {
  from: string;
  to: string;
  days: number;
}

export interface ReportMetrics {
  routesTotal: number;
  routesCompleted: number;
  routesCancelled: number;
  routesInProgress: number;
  stopsTotal: number;
  stopsCompleted: number;
  stopsPending: number;
  completionRate: number;
  plannedDistanceM: number;
  actualDistanceM: number;
  averageStopDurationS: number | null;
  averageRouteDurationS: number | null;
  creditsConsumed: number;
  byStatus: Record<string, number>;
}

export interface ReportDriverRanking {
  driverId: string;
  fullName: string;
  routes: number;
  stopsCompleted: number;
  plannedDistanceM: number;
  actualDistanceM: number;
}

export interface ReportRouteRow {
  id: string;
  routeDate: string;
  status: string;
  driver: { id: string; fullName: string };
  stopsTotal: number;
  stopsCompleted: number;
  stopsPending: number;
  plannedDistanceM: number;
  actualDistanceM: number;
  durationS: number | null;
}

export interface ReportSummary {
  range: ReportRange;
  metrics: ReportMetrics;
  driverRanking: ReportDriverRanking[];
  routes: ReportRouteRow[];
}

export interface RouteReport {
  range: ReportRange;
  driverRanking: ReportDriverRanking[];
  routes: ReportRouteRow[];
}

export interface CompanyDashboard {
  generatedAt: string;
  subscription: {
    planName: string;
    status: string;
    renewalDate: string | null;
    maxDrivers: number | null;
  } | null;
  credits: { total: number; planCredits: number; extraCredits: number };
  drivers: { total: number; available: number };
  orders: { pending: number; urgentPending: number };
  today: { routes: number; active: number; completed: number };
  incidents: { open: number };
  month: ReportSummary;
}

export function addDaysToBusinessDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function toCsv(rows: Array<Array<string | number | null>>): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell === null || cell === undefined ? '' : String(cell);
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(',')
    )
    .join('\n');
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null>>) {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
