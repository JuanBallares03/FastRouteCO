import { describe, expect, it } from 'vitest';
import {
  ORDER_PRIORITY_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  formatDistance,
  formatDuration,
  orderStatusVariant,
  routeStatusVariant,
  todayInBogota,
} from './order-utils';

describe('order labels', () => {
  it('translates every order type, status and priority', () => {
    expect(ORDER_TYPE_LABELS.delivery).toBe('Entrega');
    expect(ORDER_TYPE_LABELS.pickup).toBe('Recogida');
    expect(ORDER_STATUS_LABELS.pending).toBe('Pendiente');
    expect(ORDER_STATUS_LABELS.assigned).toBe('Asignado');
    expect(ORDER_PRIORITY_LABELS.urgent).toBe('Urgente');
  });

  it('maps statuses to badge variants', () => {
    expect(orderStatusVariant('completed')).toBe('success');
    expect(orderStatusVariant('assigned')).toBe('warning');
    expect(orderStatusVariant('cancelled')).toBe('neutral');
    expect(routeStatusVariant('in_progress')).toBe('warning');
  });
});

describe('formatting helpers', () => {
  it('formats distances in meters and kilometers', () => {
    expect(formatDistance(null)).toBe('Sin dato');
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(1250)).toBe('1.3 km');
  });

  it('formats durations in minutes and hours', () => {
    expect(formatDuration(null)).toBe('Sin dato');
    expect(formatDuration(600)).toBe('10 min');
    expect(formatDuration(5400)).toBe('1 h 30 min');
  });

  it('returns the current Bogotá date as YYYY-MM-DD', () => {
    expect(todayInBogota()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
