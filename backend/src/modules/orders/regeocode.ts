import type { GeocodingResult } from '../../lib/geocoding.js';

export interface OrderWithoutCoordinates {
  id: string;
  address: string;
}

export interface RegeocodeDependencies {
  findOrdersWithoutCoordinates: () => Promise<OrderWithoutCoordinates[]>;
  geocode: (address: string) => Promise<GeocodingResult | null>;
  updateCoordinates: (
    orderId: string,
    coordinates: { latitude: number; longitude: number }
  ) => Promise<void>;
  onNotFound?: (order: OrderWithoutCoordinates) => void;
  onError?: (order: OrderWithoutCoordinates, error: unknown) => void;
}

export interface RegeocodeSummary {
  total: number;
  updated: number;
  notFound: number;
  failed: number;
}

export async function regeocodeOrders(
  dependencies: RegeocodeDependencies
): Promise<RegeocodeSummary> {
  const orders = await dependencies.findOrdersWithoutCoordinates();
  let updated = 0;
  let notFound = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      const result = await dependencies.geocode(order.address);

      if (!result) {
        notFound += 1;
        dependencies.onNotFound?.(order);
        continue;
      }

      await dependencies.updateCoordinates(order.id, {
        latitude: result.latitude,
        longitude: result.longitude,
      });
      updated += 1;
    } catch (error) {
      failed += 1;
      dependencies.onError?.(order, error);
    }
  }

  return { total: orders.length, updated, notFound, failed };
}
