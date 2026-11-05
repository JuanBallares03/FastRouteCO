import 'dotenv/config';
import axios from 'axios';
import neo4j from 'neo4j-driver';
import { env } from '../env.js';
import { haversineMeters } from '../lib/geo.js';

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

interface OverpassWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

type OverpassElement = OverpassNode | OverpassWay;

interface GraphNode {
  osmId: number;
  lat: number;
  lon: number;
}

interface GraphEdge {
  from: number;
  to: number;
  wayId: number;
  segment: number;
  lengthM: number;
  highway: string;
  name: string | null;
}

const EXCLUDED_HIGHWAYS = new Set([
  'footway',
  'path',
  'cycleway',
  'pedestrian',
  'steps',
  'corridor',
  'elevator',
  'platform',
  'construction',
  'proposed',
  'raceway',
  'bus_guideway',
]);

const DEFAULT_BBOX = '4.30,-75.35,4.60,-75.05';

function readBbox(): string {
  const bbox = process.env.OSM_BBOX ?? DEFAULT_BBOX;
  const parts = bbox.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid OSM_BBOX: ${bbox}. Expected south,west,north,east.`);
  }
  return bbox;
}

function isOneWay(tags: Record<string, string> | undefined): boolean {
  if (!tags) return false;
  return ['yes', 'true', '1'].includes(tags.oneway) || tags.junction === 'roundabout';
}

async function fetchOverpass(bbox: string): Promise<OverpassElement[]> {
  const query = `[out:json][timeout:180];way["highway"](${bbox});out body;>;out skel qt;`;
  console.log(`[osm] Querying ${env.OVERPASS_URL} for bbox ${bbox}`);

  const response = await axios.post<{ elements: OverpassElement[] }>(
    env.OVERPASS_URL,
    new URLSearchParams({ data: query }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 240000,
    }
  );

  return response.data.elements;
}

function buildGraph(elements: OverpassElement[]) {
  const nodes = new Map<number, { lat: number; lon: number }>();
  for (const element of elements) {
    if (element.type === 'node') {
      nodes.set(element.id, { lat: element.lat, lon: element.lon });
    }
  }

  const edges: GraphEdge[] = [];
  for (const element of elements) {
    if (element.type !== 'way') continue;
    const highway = element.tags?.highway;
    if (!highway || EXCLUDED_HIGHWAYS.has(highway)) continue;

    const wayNodes = element.nodes;
    const oneWay = isOneWay(element.tags);
    const reversed = element.tags?.oneway === '-1';

    for (let index = 0; index < wayNodes.length - 1; index += 1) {
      const firstId = wayNodes[index];
      const secondId = wayNodes[index + 1];
      const first = nodes.get(firstId);
      const second = nodes.get(secondId);
      if (!first || !second || firstId === secondId) continue;

      const lengthM = haversineMeters(
        { latitude: first.lat, longitude: first.lon },
        { latitude: second.lat, longitude: second.lon }
      );
      if (lengthM <= 0) continue;

      const from = reversed ? secondId : firstId;
      const to = reversed ? firstId : secondId;
      const base = {
        wayId: element.id,
        segment: index,
        lengthM,
        highway,
        name: element.tags?.name ?? null,
      };

      edges.push({ ...base, from, to });
      if (!oneWay) {
        edges.push({ ...base, from: to, to: from });
      }
    }
  }

  const usedNodeIds = new Set<number>();
  for (const edge of edges) {
    usedNodeIds.add(edge.from);
    usedNodeIds.add(edge.to);
  }

  const graphNodes: GraphNode[] = [];
  for (const osmId of usedNodeIds) {
    const node = nodes.get(osmId);
    if (node) graphNodes.push({ osmId, lat: node.lat, lon: node.lon });
  }

  return { nodes: graphNodes, edges };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function importGraph(nodes: GraphNode[], edges: GraphEdge[]) {
  const driver = neo4j.driver(
    env.NEO4J_URI,
    neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD)
  );
  const session = driver.session();

  try {
    await session.run(
      'CREATE CONSTRAINT intersection_osm_id IF NOT EXISTS FOR (n:Intersection) REQUIRE n.osmId IS UNIQUE'
    );
    await session.run(
      'CREATE POINT INDEX intersection_location IF NOT EXISTS FOR (n:Intersection) ON (n.location)'
    );

    for (const batch of chunk(nodes, 2000)) {
      await session.run(
        `UNWIND $nodes AS node
         MERGE (n:Intersection {osmId: node.osmId})
         SET n.latitude = node.lat,
             n.longitude = node.lon,
             n.location = point({srid: 4326, x: node.lon, y: node.lat})`,
        { nodes: batch }
      );
    }

    for (const batch of chunk(edges, 2000)) {
      await session.run(
        `UNWIND $edges AS edge
         MATCH (from:Intersection {osmId: edge.from})
         MATCH (to:Intersection {osmId: edge.to})
         MERGE (from)-[road:ROAD {wayId: edge.wayId, segment: edge.segment}]->(to)
         SET road.lengthM = edge.lengthM,
             road.highway = edge.highway,
             road.name = edge.name`,
        { edges: batch }
      );
    }
  } finally {
    await session.close();
    await driver.close();
  }
}

async function main() {
  const bbox = readBbox();
  const elements = await fetchOverpass(bbox);
  console.log(`[osm] Downloaded ${elements.length} elements`);

  const { nodes, edges } = buildGraph(elements);
  console.log(`[osm] Graph has ${nodes.length} intersections and ${edges.length} directed segments`);

  await importGraph(nodes, edges);
  console.log('[osm] Import finished');
}

main().catch((error) => {
  console.error('[osm] Import failed:', error);
  process.exit(1);
});
