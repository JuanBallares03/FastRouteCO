const MINIMUM_IMPROVEMENT_METERS = 1;

export function pathDistance(
  distances: number[][],
  path: number[]
): number {
  let total = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    total += distances[path[index]][path[index + 1]];
  }
  return total;
}

function nearestNeighborOrder(distances: number[][], stopCount: number): number[] {
  const pending = new Set<number>();
  for (let index = 0; index < stopCount; index += 1) {
    pending.add(index + 1);
  }

  const order: number[] = [];
  let current = 0;

  while (pending.size > 0) {
    let next = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of pending) {
      const distance = distances[current][candidate];
      if (distance < bestDistance || (distance === bestDistance && candidate < next)) {
        bestDistance = distance;
        next = candidate;
      }
    }

    if (next === -1) break;
    order.push(next);
    pending.delete(next);
    current = next;
  }

  return order;
}

function twoOptImprove(distances: number[][], order: number[]): number[] {
  let path = [0, ...order];
  let improved = true;

  while (improved) {
    improved = false;
    let currentCost = pathDistance(distances, path);

    for (let start = 1; start < path.length - 1; start += 1) {
      for (let end = start + 1; end < path.length; end += 1) {
        const candidate = [
          ...path.slice(0, start),
          ...path.slice(start, end + 1).reverse(),
          ...path.slice(end + 1),
        ];
        const candidateCost = pathDistance(distances, candidate);

        if (candidateCost < currentCost - MINIMUM_IMPROVEMENT_METERS) {
          path = candidate;
          currentCost = candidateCost;
          improved = true;
        }
      }
    }
  }

  return path.slice(1).map((index) => index - 1);
}

export function optimizeStopOrder(
  distances: number[][],
  stopCount: number
): number[] {
  if (stopCount <= 0) return [];
  if (stopCount === 1) return [0];

  const initial = nearestNeighborOrder(distances, stopCount);
  return twoOptImprove(distances, initial);
}

export function totalPathDistance(
  distances: number[][],
  stopOrder: number[]
): number {
  return pathDistance(distances, [0, ...stopOrder.map((index) => index + 1)]);
}

export function totalPathDuration(
  durations: number[][],
  stopOrder: number[]
): number {
  return pathDistance(durations, [0, ...stopOrder.map((index) => index + 1)]);
}
