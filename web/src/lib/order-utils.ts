export const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery: 'Entrega',
  pickup: 'Recogida',
};

export const ORDER_PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  urgent: 'Urgente',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const ORDER_CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  phone_call: 'Llamada telefónica',
  in_person: 'Presencial',
};

export const ROUTE_STATUS_LABELS: Record<string, string> = {
  created: 'Creada',
  optimized: 'Optimizada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

export const STOP_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  arrived: 'En sitio',
  completed: 'Completado',
};

export function orderStatusVariant(status: string): 'success' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'assigned':
      return 'warning';
    case 'pending':
      return 'info';
    default:
      return 'neutral';
  }
}

export function routeStatusVariant(status: string): 'success' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'warning';
    case 'optimized':
      return 'info';
    default:
      return 'neutral';
  }
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return 'Sin dato';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'Sin dato';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours} h ${remaining} min`;
}

export function todayInBogota(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
