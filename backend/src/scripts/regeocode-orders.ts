import 'dotenv/config';
import { getGeocoder } from '../lib/geocoding.js';
import { prisma } from '../lib/prisma.js';
import { regeocodeOrders } from '../modules/orders/regeocode.js';

async function main() {
  const summary = await regeocodeOrders({
    findOrdersWithoutCoordinates: () =>
      prisma.order.findMany({
        where: {
          OR: [{ latitude: null }, { longitude: null }],
        },
        select: { id: true, address: true },
        orderBy: { createdAt: 'asc' },
      }),
    geocode: (address) => getGeocoder().geocode(address),
    updateCoordinates: async (orderId, coordinates) => {
      await prisma.order.update({ where: { id: orderId }, data: coordinates });
    },
    onNotFound: (order) => {
      console.warn(`[regeocode-orders] Not found: ${order.id} -> ${order.address}`);
    },
    onError: (order, error) => {
      console.error(`[regeocode-orders] Failed: ${order.id} -> ${order.address}`, error);
    },
  });

  console.log(`[regeocode-orders] Result: ${JSON.stringify(summary)}`);
  await prisma.$disconnect();

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error('[regeocode-orders] Failed:', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
