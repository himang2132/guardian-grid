import { CityGraph, GraphNode, GraphEdge, TrafficLevel } from './types';

const TRAFFIC_MULTIPLIERS: Record<TrafficLevel, number> = {
  low: 1.0,
  medium: 1.5,
  high: 2.5,
};

// Generate a city-like graph with ~40 nodes
export function generateCityGraph(): CityGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Create a grid-like layout with some randomness for organic feel
  const cols = 8;
  const rows = 5;
  const spacingX = 120;
  const spacingY = 110;
  const offsetX = 80;
  const offsetY = 60;

  let nodeIndex = 0;
  const grid: (string | null)[][] = [];

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      // Skip some positions for organic feel
      if (Math.random() < 0.1 && nodeIndex > 3) {
        grid[r][c] = null;
        continue;
      }
      const id = `N${nodeIndex}`;
      const jitterX = (Math.random() - 0.5) * 40;
      const jitterY = (Math.random() - 0.5) * 30;

      let type: GraphNode['type'] = 'junction';
      if (nodeIndex === 0 || nodeIndex === 15) type = 'station';
      if (nodeIndex === 7 || nodeIndex === 30 || nodeIndex === 20) type = 'hospital';

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

  // Connect adjacent nodes in grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const current = grid[r][c];
      if (!current) continue;

      // Right neighbor
      if (c + 1 < cols && grid[r][c + 1]) {
        addEdge(edges, nodes, current, grid[r][c + 1]!);
      }
      // Bottom neighbor
      if (r + 1 < rows && grid[r + 1]?.[c]) {
        addEdge(edges, nodes, current, grid[r + 1][c]!);
      }
      // Diagonal (sometimes)
      if (Math.random() < 0.3 && r + 1 < rows && c + 1 < cols && grid[r + 1]?.[c + 1]) {
        addEdge(edges, nodes, current, grid[r + 1][c + 1]!);
      }
    }
  }

  // Add some extra cross-connections for variety
  for (let i = 0; i < 5; i++) {
    const a = nodes[Math.floor(Math.random() * nodes.length)];
    const b = nodes[Math.floor(Math.random() * nodes.length)];
    if (a.id !== b.id && !edges.find(e => (e.from === a.id && e.to === b.id) || (e.from === b.id && e.to === a.id))) {
      const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
      if (dist < 300) {
        addEdge(edges, nodes, a.id, b.id);
      }
    }
  }

  return { nodes, edges };
}

function addEdge(edges: GraphEdge[], nodes: GraphNode[], from: string, to: string) {
  const nodeA = nodes.find(n => n.id === from)!;
  const nodeB = nodes.find(n => n.id === to)!;
  const pixelDist = Math.sqrt((nodeA.x - nodeB.x) ** 2 + (nodeA.y - nodeB.y) ** 2);
  const distance = Math.round(pixelDist / 30 * 10) / 10; // Convert to km-like unit
  const baseWeight = Math.round(distance * 60); // ~60s per km base

  const trafficLevels: TrafficLevel[] = ['low', 'medium', 'high'];
  const traffic = trafficLevels[Math.floor(Math.random() * 3)];

  edges.push({ from, to, baseWeight, distance, trafficLevel: traffic });
}

export function getEffectiveWeight(edge: GraphEdge): number {
  return Math.round(edge.baseWeight * TRAFFIC_MULTIPLIERS[edge.trafficLevel]);
}

export function buildAdjacencyList(graph: CityGraph): Map<string, { neighbor: string; weight: number; distance: number }[]> {
  const adj = new Map<string, { neighbor: string; weight: number; distance: number }[]>();
  
  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }

  for (const edge of graph.edges) {
    const w = getEffectiveWeight(edge);
    adj.get(edge.from)!.push({ neighbor: edge.to, weight: w, distance: edge.distance });
    adj.get(edge.to)!.push({ neighbor: edge.from, weight: w, distance: edge.distance });
  }

  return adj;
}

export function updateTrafficLevels(graph: CityGraph, globalLevel: TrafficLevel): CityGraph {
  return {
    ...graph,
    edges: graph.edges.map(e => ({
      ...e,
      trafficLevel: globalLevel,
    })),
  };
}

export function randomizeTraffic(graph: CityGraph): CityGraph {
  const levels: TrafficLevel[] = ['low', 'medium', 'high'];
  return {
    ...graph,
    edges: graph.edges.map(e => ({
      ...e,
      trafficLevel: levels[Math.floor(Math.random() * 3)],
    })),
  };
}
