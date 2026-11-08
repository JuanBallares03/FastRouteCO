import type { Coordinates, RouteStop } from './types';

const EARTH_RADIUS_M = 6371000;
export const GEOFENCE_RADIUS_M = 100;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)));
}

export function stopCoordinates(stop: RouteStop): Coordinates | null {
  const source = stop.order ?? stop.student;
  if (!source || source.latitude === null || source.longitude === null) {
    return null;
  }

  return { latitude: source.latitude, longitude: source.longitude };
}

export function isInsideGeofence(stop: RouteStop, position: Coordinates): boolean {
  const target = stopCoordinates(stop);
  if (!target) return false;
  return distanceMeters(position, target) <= GEOFENCE_RADIUS_M;
}
