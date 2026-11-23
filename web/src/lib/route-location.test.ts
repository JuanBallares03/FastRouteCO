import { describe, expect, it } from 'vitest';
import {
  latestFromBatch,
  mergeLocationsByRoute,
  pickLatestLocation,
  type TrackedLocation,
} from './route-location';

const older: TrackedLocation = {
  latitude: 4.4389,
  longitude: -75.2322,
  capturedAt: '2026-11-06T12:00:00.000Z',
};
const newer: TrackedLocation = {
  latitude: 4.4391,
  longitude: -75.2324,
  capturedAt: '2026-11-06T12:00:05.000Z',
};

describe('pickLatestLocation', () => {
  it('keeps the position with the newest capture time', () => {
    expect(pickLatestLocation(older, newer)).toBe(newer);
    expect(pickLatestLocation(newer, older)).toBe(newer);
  });

  it('keeps the current position when the incoming one is missing', () => {
    expect(pickLatestLocation(newer, null)).toBe(newer);
    expect(pickLatestLocation(null, newer)).toBe(newer);
    expect(pickLatestLocation(null, null)).toBeNull();
  });

  it('prefers a position with a capture time over one without it', () => {
    const untimed = { latitude: 1, longitude: 1 };
    expect(pickLatestLocation(newer, untimed)).toBe(newer);
    expect(pickLatestLocation(untimed, newer)).toBe(newer);
  });
});

describe('latestFromBatch', () => {
  it('picks the newest point regardless of its order in the batch', () => {
    expect(latestFromBatch([newer, older])).toBe(newer);
    expect(latestFromBatch([])).toBeNull();
    expect(latestFromBatch(undefined)).toBeNull();
  });
});

describe('mergeLocationsByRoute', () => {
  it('does not lose a socket position when the reload returns nothing', () => {
    const merged = mergeLocationsByRoute({ 'route-1': newer }, { 'route-1': null }, ['route-1']);
    expect(merged).toEqual({ 'route-1': newer });
  });

  it('does not replace a socket position with an older fetched one', () => {
    const merged = mergeLocationsByRoute({ 'route-1': newer }, { 'route-1': older }, ['route-1']);
    expect(merged['route-1']).toBe(newer);
  });

  it('takes a fetched position that is newer than the current one', () => {
    const merged = mergeLocationsByRoute({ 'route-1': older }, { 'route-1': newer }, ['route-1']);
    expect(merged['route-1']).toBe(newer);
  });

  it('drops routes that are no longer in progress', () => {
    const merged = mergeLocationsByRoute(
      { 'route-1': older, 'route-2': newer },
      { 'route-1': older },
      ['route-1']
    );
    expect(merged).toEqual({ 'route-1': older });
  });
});
