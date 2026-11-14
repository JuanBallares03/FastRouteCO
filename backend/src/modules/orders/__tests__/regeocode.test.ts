import { describe, expect, it, vi } from 'vitest';
import { regeocodeOrders, type RegeocodeDependencies } from '../regeocode.js';

function createDependencies(
  overrides: Partial<RegeocodeDependencies> = {}
): RegeocodeDependencies {
  return {
    findOrdersWithoutCoordinates: vi.fn(async () => []),
    geocode: vi.fn(async () => null),
    updateCoordinates: vi.fn(async () => undefined),
    onNotFound: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

describe('regeocode orders', () => {
  it('updates found addresses and reports not found or failed ones', async () => {
    const notFoundOrder = { id: 'order-2', address: 'Dirección inexistente' };
    const failedOrder = { id: 'order-3', address: 'Dirección con error' };
    const failure = new Error('network down');

    const dependencies = createDependencies({
      findOrdersWithoutCoordinates: vi.fn(async () => [
        { id: 'order-1', address: 'Calle 10 # 5-20, Ibagué' },
        notFoundOrder,
        failedOrder,
      ]),
      geocode: vi.fn(async (address: string) => {
        if (address === 'Calle 10 # 5-20, Ibagué') {
          return {
            latitude: 4.4389,
            longitude: -75.2322,
            displayName: 'Calle 10, Ibagué',
          };
        }
        if (address === 'Dirección inexistente') {
          return null;
        }
        throw failure;
      }),
    });

    const summary = await regeocodeOrders(dependencies);

    expect(summary).toEqual({ total: 3, updated: 1, notFound: 1, failed: 1 });
    expect(dependencies.updateCoordinates).toHaveBeenCalledWith('order-1', {
      latitude: 4.4389,
      longitude: -75.2322,
    });
    expect(dependencies.onNotFound).toHaveBeenCalledWith(notFoundOrder);
    expect(dependencies.onError).toHaveBeenCalledWith(failedOrder, failure);
  });

  it('returns an empty summary when every order is already geocoded', async () => {
    const dependencies = createDependencies();

    const summary = await regeocodeOrders(dependencies);

    expect(summary).toEqual({ total: 0, updated: 0, notFound: 0, failed: 0 });
    expect(dependencies.geocode).not.toHaveBeenCalled();
  });
});
