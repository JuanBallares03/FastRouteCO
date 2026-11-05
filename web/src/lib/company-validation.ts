export type DriverStatus = 'available' | 'on_route' | 'unavailable';

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  available: 'Disponible',
  on_route: 'En ruta',
  unavailable: 'No disponible',
};

export function validateRequired(value: string, label: string): string {
  if (!value.trim()) {
    return `${label} es obligatorio`;
  }
  return '';
}

export function validateEmail(value: string): string {
  if (!value.trim()) {
    return 'El correo electrónico es obligatorio';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Formato de correo inválido';
  }
  return '';
}

export function validatePhone(value: string): string {
  if (value.trim() && value.replace(/\D/g, '').length < 10) {
    return 'Número de teléfono inválido';
  }
  return '';
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } };
  return candidate.response?.data?.message ?? fallback;
}
