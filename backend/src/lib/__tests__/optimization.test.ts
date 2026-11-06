import { describe, expect, it } from 'vitest';
import {
  optimizeStopOrder,
  totalPathDistance,
  totalPathDuration,
} from '../optimization.js';

describe('Stop order optimization', () => {
  it('returns an empty order when there are no stops', () => {
    expect(optimizeStopOrder([[0]], 0)).toEqual([]);
  });

  it('keeps a single stop', () => {
    expect(optimizeStopOrder([[0, 5], [5, 0]], 1)).toEqual([0]);
  });

  it('improves the nearest-neighbor order with 2-opt', () => {
    const distances = [
      [0, 8, 19, 18, 5],
      [12, 0, 20, 16, 19],
      [3, 20, 0, 1, 16],
      [9, 18, 8, 0, 7],
      [16, 18, 18, 16, 0],
    ];

    expect(optimizeStopOrder(distances, 4)).toEqual([1, 2, 3, 0]);
  });

  it('reverses a segment using the asymmetric direction', () => {
    const distances = [
      [0, 1, 2],
      [1, 0, 100],
      [2, 1, 0],
    ];

    const order = optimizeStopOrder(distances, 2);
    expect(order).toEqual([1, 0]);
    expect(totalPathDistance(distances, order)).toBe(3);
  });

  it('does not return to the starting point', () => {
    const distances = [
      [0, 10, 10],
      [10, 0, 1],
      [10, 1, 0],
    ];
    const durations = [
      [0, 100, 100],
      [100, 0, 10],
      [100, 10, 0],
    ];

    const order = optimizeStopOrder(distances, 2);
    expect(totalPathDistance(distances, order)).toBe(11);
    expect(totalPathDuration(durations, order)).toBe(110);
  });
});
