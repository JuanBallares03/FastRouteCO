import { env } from '../env.js';
import { AppError } from './errors.js';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodingResult extends Coordinates {
  displayName: string;
}

export interface Geocoder {
  geocode(address: string): Promise<GeocodingResult | null>;
}

export class GeocodingUnavailableError extends AppError {
  constructor(message = 'El servicio de geocodificación no está disponible') {
    super(message, 503, 'GEOCODING_UNAVAILABLE');
    this.name = 'GeocodingUnavailableError';
  }
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface CacheEntry {
  expiresAt: number;
  value: GeocodingResult | null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const IBAGUE_VIEWBOX = '-75.35,4.60,-75.05,4.30';

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class NominatimGeocoder implements Geocoder {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string
  ) {}

  async geocode(address: string): Promise<GeocodingResult | null> {
    const key = normalizeAddress(address);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const params = new URLSearchParams({
      q: address,
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'co',
      viewbox: IBAGUE_VIEWBOX,
      bounded: '0',
    });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/search?${params.toString()}`, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      throw new GeocodingUnavailableError();
    }

    if (!response.ok) {
      throw new GeocodingUnavailableError();
    }

    let results: NominatimResult[];
    try {
      results = (await response.json()) as NominatimResult[];
    } catch {
      throw new GeocodingUnavailableError();
    }

    const first = Array.isArray(results) ? results[0] : undefined;
    const value: GeocodingResult | null = first
      ? {
          latitude: Number(first.lat),
          longitude: Number(first.lon),
          displayName: first.display_name,
        }
      : null;

    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      expiresAt: Date.now() + (value ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
      value,
    });

    return value;
  }
}

let activeGeocoder: Geocoder = new NominatimGeocoder(
  env.NOMINATIM_URL,
  env.NOMINATIM_USER_AGENT
);

export function getGeocoder(): Geocoder {
  return activeGeocoder;
}

export function setGeocoder(geocoder: Geocoder): void {
  activeGeocoder = geocoder;
}

export function resetGeocoder(): void {
  activeGeocoder = new NominatimGeocoder(env.NOMINATIM_URL, env.NOMINATIM_USER_AGENT);
}
