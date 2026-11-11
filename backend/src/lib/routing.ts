import neo4j, { type Driver } from 'neo4j-driver';
import { env } from '../env.js';
import { haversineMeters } from './geo.js';
import type { Coordinates } from './geocoding.js';

export type LngLat = [number, number];

export interface RoutePath {
  distanceMeters: number;
  durationSeconds: number;
  geometry: LngLat[];
  approximate: boolean;
  provider: 'neo4j' | 'fallback';
}

export interface DistanceMatrix {
  distances: number[][];
  durations: number[][];
  approximate: boolean;
}

export interface RoutingEngine {
  shortestPath(from: Coordinates, to: Coordinates): Promise<RoutePath>;
  distanceMatrix(points: Coordinates[]): Promise<DistanceMatrix>;
}

const MAX_NEAREST_NODE_DISTANCE_M = 3000;

export interface BoundingBox {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export function boundingBoxAround(
  point: Coordinates,
  radiusMeters = MAX_NEAREST_NODE_DISTANCE_M
): BoundingBox {
  const latitudeDelta = radiusMeters / 111320;
  const cosine = Math.cos((point.latitude * Math.PI) / 180);
  const longitudeDelta =
    Math.abs(cosine) < 1e-6
      ? 180
      : Math.min(180, radiusMeters / (111320 * Math.abs(cosine)));

  return {
    minLatitude: Math.max(-90, point.latitude - latitudeDelta),
    maxLatitude: Math.min(90, point.latitude + latitudeDelta),
    minLongitude: Math.max(-180, point.longitude - longitudeDelta),
    maxLongitude: Math.min(180, point.longitude + longitudeDelta),
  };
}

function durationSeconds(distanceMeters: number): number {
  const speedMetersPerSecond = (env.ROUTING_AVG_SPEED_KMH * 1000) / 3600;
  return Math.round(distanceMeters / speedMetersPerSecond);
}

export function approximateMatrix(points: Coordinates[]): DistanceMatrix {
  const distances = points.map((from) =>
    points.map((to) => (from === to ? 0 : approximatePath(from, to).distanceMeters))
  );

  return {
    distances,
    durations: distances.map((row) => row.map(durationSeconds)),
    approximate: true,
  };
}

export function approximatePath(from: Coordinates, to: Coordinates): RoutePath {
  const straightLine = haversineMeters(from, to);
  const distanceMeters = Math.round(straightLine * env.ROUTING_ROAD_FACTOR);

  return {
    distanceMeters,
    durationSeconds: durationSeconds(distanceMeters),
    geometry: [
      [from.longitude, from.latitude],
      [to.longitude, to.latitude],
    ],
    approximate: true,
    provider: 'fallback',
  };
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

export class Neo4jRoutingEngine implements RoutingEngine {
  private driver: Driver | null = null;

  private getDriver(): Driver {
    if (!this.driver) {
      this.driver = neo4j.driver(
        env.NEO4J_URI,
        neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD),
        { connectionTimeout: 3000 }
      );
    }
    return this.driver;
  }

  async shortestPath(from: Coordinates, to: Coordinates): Promise<RoutePath> {
    const session = this.getDriver().session();
    try {
      const start = await this.nearestNode(session, from);
      const end = await this.nearestNode(session, to);
      if (!start || !end) return approximatePath(from, to);

      const result = await session.run(
        `MATCH (start:Intersection {osmId: $start}), (end:Intersection {osmId: $end})
         CALL apoc.algo.dijkstra(start, end, 'ROAD>', 'lengthM') YIELD path, weight
         RETURN weight AS distanceM, [n IN nodes(path) | [n.longitude, n.latitude]] AS geometry`,
        { start: start.osmId, end: end.osmId }
      );

      const record = result.records[0];
      if (!record) return approximatePath(from, to);

      const distanceMeters = Math.round(toNumber(record.get('distanceM')));
      const geometry = (record.get('geometry') as number[][]).map(
        ([longitude, latitude]) => [Number(longitude), Number(latitude)] as LngLat
      );

      if (!Number.isFinite(distanceMeters) || geometry.length === 0) {
        return approximatePath(from, to);
      }

      return {
        distanceMeters,
        durationSeconds: durationSeconds(distanceMeters),
        geometry,
        approximate: false,
        provider: 'neo4j',
      };
    } catch (error) {
      console.warn('[routing] Neo4j unavailable, using approximate distance', error);
      return approximatePath(from, to);
    } finally {
      await session.close();
    }
  }

  async distanceMatrix(points: Coordinates[]): Promise<DistanceMatrix> {
    if (points.length === 0) {
      return { distances: [], durations: [], approximate: false };
    }

    const fallback = approximateMatrix(points);
    const session = this.getDriver().session();

    try {
      const nearest = await this.nearestNodes(session, points);
      if (nearest.some((node) => node === null)) {
        return fallback;
      }

      const osmIds = nearest.map((node) => (node as { osmId: number }).osmId);
      const distances = fallback.distances.map((row) => [...row]);
      let approximate = false;

      for (let index = 0; index < points.length; index += 1) {
        const targetIds = osmIds.filter((_, targetIndex) => targetIndex !== index);
        if (targetIds.length === 0) continue;

        const result = await session.run(
          `MATCH (start:Intersection {osmId: $startId})
           UNWIND $targetIds AS targetId
           MATCH (end:Intersection {osmId: targetId})
           CALL apoc.algo.dijkstra(start, end, 'ROAD>', 'lengthM') YIELD weight
           RETURN targetId AS targetId, weight AS weight`,
          { startId: osmIds[index], targetIds }
        );

        const row = new Map<number, number>();
        for (const record of result.records) {
          const targetId = toNumber(record.get('targetId'));
          const weight = toNumber(record.get('weight'));
          if (Number.isFinite(weight)) {
            row.set(targetId, Math.round(weight));
          }
        }

        for (let targetIndex = 0; targetIndex < points.length; targetIndex += 1) {
          if (targetIndex === index) continue;
          const value = row.get(osmIds[targetIndex]);
          if (value === undefined) {
            approximate = true;
          } else {
            distances[index][targetIndex] = value;
          }
        }
        distances[index][index] = 0;
      }

      return {
        distances,
        durations: distances.map((row) => row.map(durationSeconds)),
        approximate,
      };
    } catch (error) {
      console.warn('[routing] Neo4j matrix unavailable, using approximate distances', error);
      return fallback;
    } finally {
      await session.close();
    }
  }

  private async nearestNodes(
    session: ReturnType<Driver['session']>,
    points: Coordinates[]
  ): Promise<Array<{ osmId: number; distance: number } | null>> {
    const result = await session.run(
      `UNWIND $points AS p
       MATCH (n:Intersection)
       WHERE n.location IS NOT NULL
         AND point.withinBBox(
           n.location,
           point({srid: 4326, x: p.minLongitude, y: p.minLatitude}),
           point({srid: 4326, x: p.maxLongitude, y: p.maxLatitude})
         )
       WITH p.idx AS idx, n,
            point.distance(n.location, point({srid: 4326, x: p.longitude, y: p.latitude})) AS distance
       ORDER BY idx, distance ASC
       WITH idx, collect({ osmId: n.osmId, distance: distance })[0] AS nearest
       RETURN idx AS idx, nearest.osmId AS osmId, nearest.distance AS distance
       ORDER BY idx ASC`,
      {
        points: points.map((point, idx) => ({
          idx,
          latitude: point.latitude,
          longitude: point.longitude,
          ...boundingBoxAround(point),
        })),
      }
    );

    const nodes: Array<{ osmId: number; distance: number } | null> = points.map(() => null);

    for (const record of result.records) {
      const index = toNumber(record.get('idx'));
      const distance = toNumber(record.get('distance'));
      if (index < 0 || index >= points.length) continue;
      if (!Number.isFinite(distance) || distance > MAX_NEAREST_NODE_DISTANCE_M) continue;
      nodes[index] = { osmId: toNumber(record.get('osmId')), distance };
    }

    return nodes;
  }

  private async nearestNode(
    session: ReturnType<Driver['session']>,
    point: Coordinates
  ): Promise<{ osmId: number; distance: number } | null> {
    const box = boundingBoxAround(point);
    const result = await session.run(
      `MATCH (n:Intersection)
       WHERE n.location IS NOT NULL
         AND point.withinBBox(
           n.location,
           point({srid: 4326, x: $minLongitude, y: $minLatitude}),
           point({srid: 4326, x: $maxLongitude, y: $maxLatitude})
         )
       RETURN n.osmId AS osmId,
              point.distance(n.location, point({srid: 4326, x: $longitude, y: $latitude})) AS distance
       ORDER BY distance ASC
       LIMIT 1`,
      {
        latitude: point.latitude,
        longitude: point.longitude,
        ...box,
      }
    );

    const record = result.records[0];
    if (!record) return null;

    const distance = toNumber(record.get('distance'));
    if (!Number.isFinite(distance) || distance > MAX_NEAREST_NODE_DISTANCE_M) {
      return null;
    }

    return { osmId: toNumber(record.get('osmId')), distance };
  }
}

let activeRoutingEngine: RoutingEngine = new Neo4jRoutingEngine();

export function getRoutingEngine(): RoutingEngine {
  return activeRoutingEngine;
}

export function setRoutingEngine(engine: RoutingEngine): void {
  activeRoutingEngine = engine;
}

export function resetRoutingEngine(): void {
  activeRoutingEngine = new Neo4jRoutingEngine();
}
