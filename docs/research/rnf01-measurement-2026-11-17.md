# RNF01 — Route optimization performance measurement (2026-11-17)

Production measurement of route optimization against RNF01 (a route is optimized in 10 seconds or less, including the distance matrix). Its result is the source of the provisional 10-stop limit enforced by the backend (AUD-07).

## Configuration

| Item | Value |
|---|---|
| Host | Azure `Standard_B2als_v2`, x64, 2 vCPU, 4 GB of RAM (production) |
| Road network | Ibagué, 88,931 intersections and 175,910 segments |
| Sample center | 4.4389, -75.2322 (Ibagué) |
| Sample radius | 3,000 m |
| Stops per case | 10, 25, 50 |
| Runs per case | 5 (the first run is discarded as warm-up) |
| Random seed | Fixed `mulberry32` seed per case: 1010, 1025 and 1050 (1000 + stop count) |
| Measurement script | `backend/src/scripts/measure-optimization.ts` |
| Matrix source | `Neo4jRoutingEngine.distanceMatrix` in `backend/src/lib/routing.ts` |
| Order algorithm | Deterministic nearest neighbor followed by 2-opt (`backend/src/lib/optimization.ts`) |
| Peak RSS | 81 MB |

All reported samples have `approximate=false`; samples whose matrix fell back to straight-line distances are discarded. The script obtains real intersections from the imported graph inside the sample area, picks one start point plus the requested stops with the fixed seed, and times the matrix and the order algorithm separately with `performance.now()`.

## Method

1. Fetch every real `Intersection` inside the 3 km box around the center from Neo4j.
2. For each stop count, pick one start point and the stops from that pool with the fixed seed.
3. Run the case 5 times. The first run is discarded as warm-up to separate cold Neo4j, driver and JIT costs.
4. Keep only samples with `approximate=false` and report the median and maximum of the remaining runs.
5. Report the optimized distance and duration of the last valid sample.

## Results

| Stops | Valid samples | Total median (ms) | Total maximum (ms) | Distance (km) | Duration (min) | Meets RNF01 (10,000 ms) |
|---:|---:|---:|---:|---:|---:|:---:|
| 10 | 4/4 | 4,912.6 | 6,794.7 | 38.78 | 93.1 | Yes |
| 25 | 4/4 | 21,535.6 | 23,368.3 | 48.09 | 115.4 | No |
| 50 | 4/4 | 73,085.2 | 73,224.6 | 66.13 | 158.7 | No |

Total time is the matrix plus the order algorithm. The algorithm (nearest neighbor + 2-opt) stays below 15 ms in every case, so the distance matrix accounts for almost all the measured time.

## How the distance matrix is calculated today

`Neo4jRoutingEngine.distanceMatrix` (`backend/src/lib/routing.ts:151`) receives the start point plus the stops and does the following:

1. `nearestNodes` (`backend/src/lib/routing.ts:216`) runs one Cypher query for all points. For each point it searches the `Intersection` nodes inside a 3 km box and keeps the closest one.
2. It then runs **one Cypher query per origin**. Each query unwinds all the other points and calls `apoc.algo.dijkstra(start, end, 'ROAD>', 'lengthM')` once per target (`backend/src/lib/routing.ts:173`).
3. The matrix is therefore asymmetric, because the graph is traversed over directed relationships (`ROAD>`), which matches one-way streets.
4. Durations are not edge travel times from the graph. They are derived from each distance with `ROUTING_AVG_SPEED_KMH` (`backend/src/lib/routing.ts:55`).
5. If a nearest intersection is missing or Neo4j fails, the method returns the straight-line matrix (`approximateMatrix`). If an individual path has no result, only that entry keeps the straight-line value and the matrix is flagged `approximate`.

The result is **not one Dijkstra per pair sent as separate requests**, but the effect is similar: with `N = stops + 1` points, the method performs `N × (N - 1)` Dijkstra searches, plus one nearest-node query and `N` Cypher round trips. At 50 stops that is 51 points and 2,550 Dijkstra searches; at 10 stops it is 11 points and 110 searches. The gap between 4.9 s and 73.1 s follows the growth of that work and of each search over the graph.

## Future improvements

These are proposals for future work, not implemented here. Expected impacts are estimates and must be verified with the same script after each change.

1. **Single-source, multi-target Dijkstra per origin.** Replace the per-target `apoc.algo.dijkstra` calls with one traversal per origin that collects the distance to every target (for example a GDS single-source shortest-path stream, or a custom procedure). The number of shortest-path searches drops from `N × (N - 1)` to `N`: 2,550 to 51 at 50 stops. Expected impact: roughly one order of magnitude less routing work, enough to bring medium routes below RNF01 if per-search overhead dominates. Cost: a new graph algorithm dependency or plugin and a new query shape.
2. **Cache nearest intersections and matrix entries.** Keep the nearest `osmId` per coordinate and the directed `osmId → osmId` distances in Redis with a TTL. Expected impact: repeated optimizations of the same or overlapping routes become nearly instantaneous, while the first optimization of a new set of stops keeps today's cost. Cost: cache invalidation when the graph is re-imported and bounded memory for the TTL.
3. **Move the shortest-path work to a preprocessed routing engine.** Use a contraction-hierarchy engine (OSRM or Valhalla) or a preprocessed graph in PostgreSQL (pgRouting) instead of running Dijkstra inside Neo4j for every target. Expected impact: sub-second matrices for 50 or more stops and a much higher stop limit, because queries no longer traverse the full graph. Cost: another service and import pipeline to deploy on the 4 GB VM. A cheaper intermediate step is to run the per-origin Cypher queries with bounded concurrency, which overlaps round trips but gains little on a 2 vCPU host.

## Conclusion

With the current matrix implementation, only the 10-stop case meets RNF01: its median is 4.9 s and its maximum is 6.8 s. The 25-stop case is about 2.2 times over the limit and the 50-stop case is about 7.3 times over it. The order algorithm is not the bottleneck; the distance matrix is.

For that reason the backend enforces a **provisional limit of 10 stops per route** (`MAX_ROUTE_STOPS = 10` in `backend/src/modules/routes/constants.ts`, error code `ROUTE_STOP_LIMIT_EXCEEDED`, Spanish message). The limit comes from this measurement, not from a requirement: the requirements do not define a final maximum. It can be raised after the matrix is optimized and the new limit is validated with this same script.
