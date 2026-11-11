import 'dotenv/config';
import neo4j from 'neo4j-driver';
import { performance } from 'node:perf_hooks';
import { env } from '../env.js';
import { Neo4jRoutingEngine } from '../lib/routing.js';
import {
  optimizeStopOrder,
  totalPathDistance,
  totalPathDuration,
} from '../lib/optimization.js';

const CENTER = { latitude: 4.4389, longitude: -75.2322 };
const STOP_RADIUS_M = 3000;
const STOP_COUNTS = [10, 25, 50];
const RUNS_PER_CASE = 5;

interface Coordinates {
  latitude: number;
  longitude: number;
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], count: number, seed: number): T[] {
  const random = mulberry32(seed);
  const indexes = new Set<number>();
  while (indexes.size < count) {
    indexes.add(Math.floor(random() * items.length));
  }
  return [...indexes].map((index) => items[index]);
}

async function fetchIntersections(): Promise<Coordinates[]> {
  const latitudeDelta = STOP_RADIUS_M / 111320;
  const longitudeDelta =
    STOP_RADIUS_M / (111320 * Math.cos((CENTER.latitude * Math.PI) / 180));
  const driver = neo4j.driver(
    env.NEO4J_URI,
    neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD)
  );
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (n:Intersection)
       WHERE n.location IS NOT NULL
         AND point.withinBBox(
           n.location,
           point({srid: 4326, x: $minLongitude, y: $minLatitude}),
           point({srid: 4326, x: $maxLongitude, y: $maxLatitude})
         )
       RETURN n.latitude AS latitude, n.longitude AS longitude`,
      {
        minLatitude: CENTER.latitude - latitudeDelta,
        maxLatitude: CENTER.latitude + latitudeDelta,
        minLongitude: CENTER.longitude - longitudeDelta,
        maxLongitude: CENTER.longitude + longitudeDelta,
      }
    );

    return result.records.map((record) => ({
      latitude: Number(record.get('latitude')),
      longitude: Number(record.get('longitude')),
    }));
  } finally {
    await session.close();
    await driver.close();
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function memoryMb() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
  };
}

interface Sample {
  matrixMs: number;
  optimizationMs: number;
  totalMs: number;
  distanceM: number;
  durationS: number;
  approximate: boolean;
  rss: number;
}

async function main() {
  const pool = await fetchIntersections();
  if (pool.length < Math.max(...STOP_COUNTS) + 1) {
    throw new Error(
      `Not enough intersections near the center: ${pool.length} available`
    );
  }

  const engine = new Neo4jRoutingEngine();
  const initialMemory = memoryMb();
  let peakRss = initialMemory.rss;

  console.log('RNF01 optimization measurement (Ibagué)');
  console.log(
    `Center: ${CENTER.latitude}, ${CENTER.longitude} | stops sampled from ${pool.length} real intersections within ${STOP_RADIUS_M} m`
  );
  console.log(
    `Node heap limit: ${process.env.NODE_OPTIONS ?? '(not set)'} | initial RSS: ${initialMemory.rss} MB`
  );
  console.log(
    `Runs per case: ${RUNS_PER_CASE} (first discarded as warm-up) | approximate samples are ignored`
  );
  console.log('');

  const rows: Array<{
    stops: number;
    validSamples: number;
    matrixMedianMs: number | null;
    matrixMaxMs: number | null;
    totalMedianMs: number | null;
    totalMaxMs: number | null;
    distanceM: number | null;
    durationS: number | null;
    peakRss: number;
    approximate: boolean;
  }> = [];

  for (const stopCount of STOP_COUNTS) {
    const [start, ...stops] = pick(pool, stopCount + 1, 1000 + stopCount);
    const points = [start, ...stops];
    const samples: Sample[] = [];

    for (let run = 0; run < RUNS_PER_CASE; run += 1) {
      const matrixStartedAt = performance.now();
      const matrix = await engine.distanceMatrix(points);
      const matrixMs = performance.now() - matrixStartedAt;

      const optimizationStartedAt = performance.now();
      const order = optimizeStopOrder(matrix.distances, stops.length);
      const totalDistanceM = Math.round(totalPathDistance(matrix.distances, order));
      const estimatedDurationS = Math.round(totalPathDuration(matrix.durations, order));
      const optimizationMs = performance.now() - optimizationStartedAt;

      const currentMemory = memoryMb();
      peakRss = Math.max(peakRss, currentMemory.rss);

      samples.push({
        matrixMs,
        optimizationMs,
        totalMs: matrixMs + optimizationMs,
        distanceM: totalDistanceM,
        durationS: estimatedDurationS,
        approximate: matrix.approximate,
        rss: currentMemory.rss,
      });

      console.log(
        `  ${stopCount} stops run ${run + 1}/${RUNS_PER_CASE}: matrix ${matrixMs.toFixed(
          1
        )} ms, optimize ${optimizationMs.toFixed(1)} ms, approximate=${matrix.approximate}`
      );
    }

    const measured = samples.slice(1);
    const valid = measured.filter((sample) => !sample.approximate);
    const matrixTimes = valid.map((sample) => sample.matrixMs);
    const totalTimes = valid.map((sample) => sample.totalMs);
    const lastValid = valid[valid.length - 1];

    rows.push({
      stops: stopCount,
      validSamples: valid.length,
      matrixMedianMs: valid.length > 0 ? median(matrixTimes) : null,
      matrixMaxMs: valid.length > 0 ? Math.max(...matrixTimes) : null,
      totalMedianMs: valid.length > 0 ? median(totalTimes) : null,
      totalMaxMs: valid.length > 0 ? Math.max(...totalTimes) : null,
      distanceM: lastValid?.distanceM ?? null,
      durationS: lastValid?.durationS ?? null,
      peakRss,
      approximate: valid.length !== measured.length,
    });

    console.log('');
  }

  console.table(
    rows.map((row) => ({
      stops: row.stops,
      valid: `${row.validSamples}/${RUNS_PER_CASE - 1}`,
      'matrix median (ms)': row.matrixMedianMs?.toFixed(1) ?? 'n/a',
      'matrix max (ms)': row.matrixMaxMs?.toFixed(1) ?? 'n/a',
      'total median (ms)': row.totalMedianMs?.toFixed(1) ?? 'n/a',
      'total max (ms)': row.totalMaxMs?.toFixed(1) ?? 'n/a',
      'distance (km)': row.distanceM === null ? 'n/a' : (row.distanceM / 1000).toFixed(2),
      'duration (min)': row.durationS === null ? 'n/a' : (row.durationS / 60).toFixed(1),
      'has approximate': row.approximate,
      'peak RSS (MB)': row.peakRss,
    }))
  );

  console.log('');
  for (const row of rows) {
    if (row.validSamples === 0) {
      console.log(
        `${row.stops} stops: no valid samples (all approximate); not usable for RNF01`
      );
      continue;
    }
    console.log(
      `${row.stops} stops: matrix median ${row.matrixMedianMs?.toFixed(
        1
      )} ms / max ${row.matrixMaxMs?.toFixed(1)} ms; total median ${row.totalMedianMs?.toFixed(
        1
      )} ms / max ${row.totalMaxMs?.toFixed(1)} ms; valid ${row.validSamples}/${
        RUNS_PER_CASE - 1
      }`
    );
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('[measure] Failed:', error);
  process.exit(1);
});
