import type { RouteStop } from './types';

export type LngLat = [number, number];
export type LngLatBounds = [number, number, number, number];

export interface RouteMapStop {
  id: string;
  sequence: number;
  latitude: number;
  longitude: number;
  label: string;
}

export interface RouteLineFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: Record<string, never>;
    geometry: {
      type: 'LineString';
      coordinates: LngLat[];
    };
  }[];
}

export interface MapFallbackInput {
  isOffline: boolean;
  hasMapStyle: boolean;
  mapFailed: boolean;
  stopCount: number;
}

export const DEVELOPMENT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

function isFiniteCoordinate(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function resolveMapStyleUrl(
  value: string | undefined,
  isDevelopment: boolean = __DEV__
): string | null {
  const styleUrl = value?.trim();
  if (styleUrl) return styleUrl;
  return isDevelopment ? DEVELOPMENT_MAP_STYLE_URL : null;
}

export function toMapStops(stops: RouteStop[]): RouteMapStop[] {
  return [...stops]
    .sort((left, right) => left.sequence - right.sequence)
    .flatMap((stop) => {
      const source = stop.order ?? stop.student;
      const latitude = source?.latitude;
      const longitude = source?.longitude;

      if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) {
        return [];
      }

      const address = stop.order?.address ?? stop.student?.pickupAddress;

      return [
        {
          id: stop.id,
          sequence: stop.sequence,
          latitude,
          longitude,
          label: address ?? `Parada ${stop.sequence}`,
        },
      ];
    });
}

export function boundsForStops(stops: RouteMapStop[]): LngLatBounds | null {
  if (stops.length === 0) return null;

  let west = stops[0].longitude;
  let east = stops[0].longitude;
  let south = stops[0].latitude;
  let north = stops[0].latitude;

  for (const stop of stops) {
    west = Math.min(west, stop.longitude);
    east = Math.max(east, stop.longitude);
    south = Math.min(south, stop.latitude);
    north = Math.max(north, stop.latitude);
  }

  return [west, south, east, north];
}

export function buildRouteLineGeoJSON(geometry: LngLat[] | null | undefined): RouteLineFeatureCollection | null {
  const coordinates = (geometry ?? []).filter(
    (point) => isFiniteCoordinate(point[0]) && isFiniteCoordinate(point[1])
  );

  if (coordinates.length < 2) return null;

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  };
}

export function mapFallbackMessage({
  isOffline,
  hasMapStyle,
  mapFailed,
  stopCount,
}: MapFallbackInput): string | null {
  if (isOffline) {
    return 'Sin conexión. No pudimos cargar el mapa; te mostramos la lista de paradas.';
  }

  if (!hasMapStyle) {
    return 'El mapa no está disponible en este momento; te mostramos la lista de paradas.';
  }

  if (stopCount === 0) {
    return 'Esta ruta no tiene paradas con ubicación en el mapa; te mostramos la lista.';
  }

  if (mapFailed) {
    return 'No pudimos cargar el mapa; te mostramos la lista de paradas.';
  }

  return null;
}
