import { describe, it, expect } from 'vitest';
import { approximatePath } from '../routing.js';
import { haversineMeters } from '../geo.js';
import { formatBusinessDate, parseBusinessDate, todayInBogota } from '../dates.js';

const from = { latitude: 4.4389, longitude: -75.2322 };
const to = { latitude: 4.445, longitude: -75.225 };

describe('Geo helpers', () => {
  it('returns zero distance for the same point', () => {
    expect(haversineMeters(from, from)).toBe(0);
  });

  it('returns a positive distance between different points', () => {
    expect(haversineMeters(from, to)).toBeGreaterThan(0);
  });
});

describe('Approximate route', () => {
  it('applies the road factor to the straight-line distance', () => {
    const straightLine = haversineMeters(from, to);
    const path = approximatePath(from, to);

    expect(path.distanceMeters).toBe(Math.round(straightLine * 1.3));
    expect(path.durationSeconds).toBeGreaterThan(0);
    expect(path.approximate).toBe(true);
    expect(path.provider).toBe('fallback');
    expect(path.geometry).toEqual([
      [from.longitude, from.latitude],
      [to.longitude, to.latitude],
    ]);
  });
});

describe('Business dates', () => {
  it('returns today in Bogotá as YYYY-MM-DD', () => {
    expect(todayInBogota()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('round-trips a valid date', () => {
    const date = parseBusinessDate('2026-11-05');
    expect(formatBusinessDate(date)).toBe('2026-11-05');
  });

  it('rejects invalid dates', () => {
    expect(() => parseBusinessDate('2026-02-30')).toThrow();
    expect(() => parseBusinessDate('05/11/2026')).toThrow();
  });
});
