import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeocodingUnavailableError, NominatimGeocoder } from '../geocoding.js';

function okResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as unknown as Response;
}

function errorResponse(): Response {
  return {
    ok: false,
    json: async () => ({}),
  } as unknown as Response;
}

let clock = 0;
const sleep = vi.fn(async (delayMs: number) => {
  clock += delayMs;
});

function createGeocoder(): NominatimGeocoder {
  return new NominatimGeocoder('https://nominatim.example/', 'FastRouteCO/1.0', {
    now: () => clock,
    sleep,
  });
}

beforeEach(() => {
  clock = 0;
  sleep.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Nominatim geocoder', () => {
  it('sends the configured user agent and Colombia-only query parameters', async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        okResponse([{ lat: '4.4389', lon: '-75.2322', display_name: 'Ibagué, Tolima' }])
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createGeocoder().geocode('Calle 10 # 5-20, Ibagué');

    expect(result).toEqual({
      latitude: 4.4389,
      longitude: -75.2322,
      displayName: 'Ibagué, Tolima',
    });

    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.origin).toBe('https://nominatim.example');
    expect(parsed.pathname).toBe('/search');
    expect(parsed.searchParams.get('q')).toBe('Calle 10 # 5-20, Ibagué');
    expect(parsed.searchParams.get('format')).toBe('jsonv2');
    expect(parsed.searchParams.get('limit')).toBe('1');
    expect(parsed.searchParams.get('countrycodes')).toBe('co');
    expect(init).toMatchObject({
      headers: {
        'User-Agent': 'FastRouteCO/1.0',
        Accept: 'application/json',
      },
    });
  });

  it('reuses cached results for equivalent addresses', async () => {
    const fetchMock = vi.fn(async () => okResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const geocoder = createGeocoder();

    await geocoder.geocode('Calle 10 # 5-20');
    await geocoder.geocode('  CALLE   10 # 5-20 ');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches addresses with no results', async () => {
    const fetchMock = vi.fn(async () => okResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const geocoder = createGeocoder();

    await expect(geocoder.geocode('Dirección inexistente')).resolves.toBeNull();
    await expect(geocoder.geocode('dirección inexistente')).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits at least one second between upstream requests', async () => {
    const fetchMock = vi.fn(async () => okResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const geocoder = createGeocoder();

    await geocoder.geocode('Calle 10');
    await geocoder.geocode('Calle 20');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('serializes concurrent requests with the same interval', async () => {
    const fetchMock = vi.fn(async () => okResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const geocoder = createGeocoder();

    await Promise.all([geocoder.geocode('Calle 10'), geocoder.geocode('Calle 20')]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('throws a service-unavailable error when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );

    await expect(createGeocoder().geocode('Calle 10')).rejects.toBeInstanceOf(
      GeocodingUnavailableError
    );
  });

  it('throws a service-unavailable error on non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => errorResponse()));

    await expect(createGeocoder().geocode('Calle 10')).rejects.toBeInstanceOf(
      GeocodingUnavailableError
    );
  });
});
