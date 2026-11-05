import { describe, it, expect } from 'vitest';
import {
  DRIVER_STATUS_LABELS,
  getApiErrorMessage,
  validateEmail,
  validatePhone,
  validateRequired,
} from './company-validation';

describe('company form validation (HU-24, HU-25, HU-27)', () => {
  it('requires non-empty values', () => {
    expect(validateRequired('', 'Nombre')).toBe('Nombre es obligatorio');
    expect(validateRequired('   ', 'Nombre')).toBe('Nombre es obligatorio');
    expect(validateRequired('Sede Centro', 'Nombre')).toBe('');
  });

  it('validates email format', () => {
    expect(validateEmail('')).toBe('El correo electrónico es obligatorio');
    expect(validateEmail('invalido')).toBe('Formato de correo inválido');
    expect(validateEmail('admin@fastrouteco.com')).toBe('');
  });

  it('validates Colombian phone numbers', () => {
    expect(validatePhone('')).toBe('');
    expect(validatePhone('123')).toBe('Número de teléfono inválido');
    expect(validatePhone('300 111 2222')).toBe('');
  });

  it('maps driver status to Spanish labels', () => {
    expect(DRIVER_STATUS_LABELS.available).toBe('Disponible');
    expect(DRIVER_STATUS_LABELS.on_route).toBe('En ruta');
    expect(DRIVER_STATUS_LABELS.unavailable).toBe('No disponible');
  });

  it('extracts backend error messages', () => {
    expect(
      getApiErrorMessage({ response: { data: { message: 'El email ya está registrado' } } }, 'Error')
    ).toBe('El email ya está registrado');
    expect(getApiErrorMessage(new Error('boom'), 'Error')).toBe('Error');
  });
});
