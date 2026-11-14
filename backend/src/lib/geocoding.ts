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
const DEFAULT_MIN_INTERVAL_MS = 1000;
const IBAGUE_VIEWBOX = '-75.35,4.60,-75.05,4.30';

interface NominatimGeocoderOptions {
  minIntervalMs?: number;
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  viewbox?: string;
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class NominatimGeocoder implements Geocoder {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly viewbox: string;
  private lastRequestAt: number | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(baseUrl: string, userAgent: string, options: NominatimGeocoderOptions = {}) {
    this.baseUrl = baseUrl;
    this.userAgent = userAgent;
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? defaultSleep;
    this.viewbox = options.viewbox ?? IBAGUE_VIEWBOX;
  }

  private runFetch(params: URLSearchParams): Promise<Response> {
    const operation = this.queue.then(async () => {
      if (this.lastRequestAt !== null) {
        const waitMs = this.minIntervalMs - (this.now() - this.lastRequestAt);
        if (waitMs > 0) {
          await this.sleep(waitMs);
        }
      }

      this.lastRequestAt = this.now();

      return fetch(`${this.baseUrl.replace(/\/$/, '')}/search?${params.toString()}`, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      });
    });

    this.queue = operation.then(
      () => undefined,
      () => undefined
    );

    return operation;
  }

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
      viewbox: this.viewbox,
      bounded: '1',
    });

    let response: Response;
    try {
      response = await this.runFetch(params);
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

function createNominatimGeocoder(): NominatimGeocoder {
  return new NominatimGeocoder(env.NOMINATIM_URL, env.NOMINATIM_USER_AGENT, {
    viewbox: env.NOMINATIM_VIEWBOX,
  });
}

let activeGeocoder: Geocoder = createNominatimGeocoder();

export function getGeocoder(): Geocoder {
  return activeGeocoder;
}

export function setGeocoder(geocoder: Geocoder): void {
  activeGeocoder = geocoder;
}

export function resetGeocoder(): void {
  activeGeocoder = createNominatimGeocoder();
}
