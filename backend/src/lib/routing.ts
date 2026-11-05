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

export interface RoutingEngine {
  shortestPath(from: Coordinates, to: Coordinates): Promise<RoutePath>;
}

const MAX_NEAREST_NODE_DISTANCE_M = 3000;

function durationSeconds(distanceMeters: number): number {
  const speedMetersPerSecond = (env.ROUTING_AVG_SPEED_KMH * 1000) / 3600;
  return Math.round(distanceMeters / speedMetersPerSecond);
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

  private async nearestNode(
    session: ReturnType<Driver['session']>,
    point: Coordinates
  ): Promise<{ osmId: number; distance: number } | null> {
    const result = await session.run(
      `MATCH (n:Intersection)
       WHERE n.location IS NOT NULL
       RETURN n.osmId AS osmId,
              point.distance(n.location, point({srid: 4326, x: $longitude, y: $latitude})) AS distance
       ORDER BY distance ASC
       LIMIT 1`,
      { latitude: point.latitude, longitude: point.longitude }
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
