import { CityGraph, GraphNode, GraphEdge, TrafficLevel } from './types';

const TRAFFIC_MULTIPLIERS: Record<TrafficLevel, number> = {
  low: 1.0,
  medium: 1.5,
  high: 2.5,
};

// Seeded PRNG for deterministic graph generation
function createSeededRNG(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Generate a complex city-like graph with ~70+ nodes (deterministic via seed)
export function generateCityGraph(seed: number = 42): CityGraph {
  const rng = createSeededRNG(seed);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const cols = 10;
  const rows = 7;
  const spacingX = 100;
  const spacingY = 80;
  const offsetX = 60;
  const offsetY = 40;

  // Hospital and station positions (deterministic)
  const hospitalIndices = new Set([5, 14, 28, 42, 55, 63]);
  const stationIndices = new Set([0, 20, 35, 48, 69]);

  let nodeIndex = 0;
  const grid: (string | null)[][] = [];

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      // Skip ~8% of interior nodes for organic feel
      if (rng() < 0.08 && nodeIndex > 3 && !hospitalIndices.has(nodeIndex) && !stationIndices.has(nodeIndex)) {
        grid[r][c] = null;
        nodeIndex++;
        continue;
      }
      const id = `N${nodeIndex}`;
      const jitterX = (rng() - 0.5) * 35;
      const jitterY = (rng() - 0.5) * 25;

      let type: GraphNode['type'] = 'junction';
      if (hospitalIndices.has(nodeIndex)) type = 'hospital';
      else if (stationIndices.has(nodeIndex)) type = 'station';

      nodes.push({
        id,
        label: type === 'hospital' ? `Hospital ${id}` : type === 'station' ? `Station ${id}` : `Junction ${id}`,
        x: offsetX + c * spacingX + jitterX,
        y: offsetY + r * spacingY + jitterY,
        type,
      });

      grid[r][c] = id;
      nodeIndex++;
    }
  }

  // Connect adjacent nodes in grid (horizontal + vertical + diagonals)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const current = grid[r][c];
      if (!current) continue;
      // Right
      if (c + 1 < cols && grid[r][c + 1]) {
        addEdge(edges, nodes, current, grid[r][c + 1]!, rng);
      }
      // Down
      if (r + 1 < rows && grid[r + 1]?.[c]) {
        addEdge(edges, nodes, current, grid[r + 1][c]!, rng);
      }
      // Diagonal down-right (~35%)
      if (rng() < 0.35 && r + 1 < rows && c + 1 < cols && grid[r + 1]?.[c + 1]) {
        addEdge(edges, nodes, current, grid[r + 1][c + 1]!, rng);
      }
      // Diagonal down-left (~20%)
      if (rng() < 0.20 && r + 1 < rows && c - 1 >= 0 && grid[r + 1]?.[c - 1]) {
        addEdge(edges, nodes, current, grid[r + 1][c - 1]!, rng);
      }
    }
  }

  // Extra cross-connections for complexity (~12 extra edges)
  for (let i = 0; i < 12; i++) {
    const a = nodes[Math.floor(rng() * nodes.length)];
    const b = nodes[Math.floor(rng() * nodes.length)];
    if (a.id !== b.id && !edges.find(e => (e.from === a.id && e.to === b.id) || (e.from === b.id && e.to === a.id))) {
      const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
      if (dist < 280) {
        addEdge(edges, nodes, a.id, b.id, rng);
      }
    }
  }

  // Add some one-way streets (~12% of edges)
  for (const edge of edges) {
    if (rng() < 0.12) {
      edge.directed = true;
    }
  }

  // Add road closures (~3%)
  const closureCount = Math.max(2, Math.floor(edges.length * 0.03));
  for (let i = 0; i < closureCount; i++) {
    const idx = Math.floor(rng() * edges.length);
    edges[idx].blocked = true;
  }

  return { nodes, edges };
}

function addEdge(edges: GraphEdge[], nodes: GraphNode[], from: string, to: string, rng: () => number = Math.random) {
  const nodeA = nodes.find(n => n.id === from)!;
  const nodeB = nodes.find(n => n.id === to)!;
  const pixelDist = Math.sqrt((nodeA.x - nodeB.x) ** 2 + (nodeA.y - nodeB.y) ** 2);
  const distance = Math.round(pixelDist / 30 * 10) / 10;
  const baseWeight = Math.round(distance * 60);

  const trafficLevels: TrafficLevel[] = ['low', 'medium', 'high'];
  const traffic = trafficLevels[Math.floor(rng() * 3)];

  edges.push({ from, to, baseWeight, distance, trafficLevel: traffic });
}

export function getEffectiveWeight(edge: GraphEdge): number {
  if (edge.blocked) return Infinity;
  return Math.round(edge.baseWeight * TRAFFIC_MULTIPLIERS[edge.trafficLevel]);
}

export function buildAdjacencyList(graph: CityGraph): Map<string, { neighbor: string; weight: number; distance: number }[]> {
  const adj = new Map<string, { neighbor: string; weight: number; distance: number }[]>();
  for (const node of graph.nodes) adj.set(node.id, []);
  for (const edge of graph.edges) {
    if (edge.blocked) continue; // skip closed roads
    const w = getEffectiveWeight(edge);
    // from→to always valid
    adj.get(edge.from)!.push({ neighbor: edge.to, weight: w, distance: edge.distance });
    // to→from only if not one-way
    if (!edge.directed) {
      adj.get(edge.to)!.push({ neighbor: edge.from, weight: w, distance: edge.distance });
    }
  }
  return adj;
}

export function updateTrafficLevels(graph: CityGraph, globalLevel: TrafficLevel): CityGraph {
  return {
    ...graph,
    edges: graph.edges.map(e => ({ ...e, trafficLevel: globalLevel })),
  };
}

export function randomizeTraffic(graph: CityGraph): CityGraph {
  const levels: TrafficLevel[] = ['low', 'medium', 'high'];
  return {
    ...graph,
    edges: graph.edges.map(e => ({ ...e, trafficLevel: levels[Math.floor(Math.random() * 3)] })),
  };
}

/** Shift a portion of edges' traffic levels randomly — used for dynamic/live traffic */
export function tickTraffic(graph: CityGraph, changeRate: number = 0.15): CityGraph {
  const levels: TrafficLevel[] = ['low', 'medium', 'high'];
  return {
    ...graph,
    edges: graph.edges.map(e => {
      if (Math.random() < changeRate) {
        const idx = levels.indexOf(e.trafficLevel);
        const shift = Math.random() < 0.5 ? -1 : 1;
        const newIdx = Math.max(0, Math.min(2, idx + shift));
        return { ...e, trafficLevel: levels[newIdx] };
      }
      return e;
    }),
  };
}

/** Toggle road closure on a specific edge */
export function toggleRoadClosure(graph: CityGraph, from: string, to: string): CityGraph {
  return {
    ...graph,
    edges: graph.edges.map(e => {
      if ((e.from === from && e.to === to) || (e.from === to && e.to === from)) {
        return { ...e, blocked: !e.blocked };
      }
      return e;
    }),
  };
}

/** Toggle one-way direction on a specific edge */
export function toggleOneWay(graph: CityGraph, from: string, to: string): CityGraph {
  return {
    ...graph,
    edges: graph.edges.map(e => {
      if ((e.from === from && e.to === to) || (e.from === to && e.to === from)) {
        return { ...e, directed: !e.directed };
      }
      return e;
    }),
  };
}
