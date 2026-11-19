export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  in_progress: 'En curso',
  resolved: 'Resuelta',
};

export const INCIDENT_CATEGORY_LABELS: Record<string, string> = {
  incident: 'Incidencia',
  question: 'Pregunta',
};

export function incidentStatusVariant(
  status: string
): 'success' | 'warning' | 'neutral' {
  switch (status) {
    case 'resolved':
      return 'success';
    case 'in_progress':
      return 'warning';
    default:
      return 'neutral';
  }
}
