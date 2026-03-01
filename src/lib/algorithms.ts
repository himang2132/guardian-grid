import { CityGraph, PathResult } from './types';
import { buildAdjacencyList } from './graphEngine';

// Min-heap priority queue
class MinHeap {
  private heap: { node: string; priority: number }[] = [];

  push(node: string, priority: number) {
    this.heap.push({ node, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { node: string; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  get size() { return this.heap.length; }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].priority <= this.heap[i].priority) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].priority < this.heap[smallest].priority) smallest = l;
      if (r < n && this.heap[r].priority < this.heap[smallest].priority) smallest = r;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

export function dijkstra(graph: CityGraph, start: string, end: string): PathResult {
  const t0 = performance.now();
  const adj = buildAdjacencyList(graph);
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const distKm = new Map<string, number>();
  const visited = new Set<string>();
  const visitedOrder: string[] = [];

  for (const node of graph.nodes) {
    dist.set(node.id, Infinity);
    distKm.set(node.id, 0);
    prev.set(node.id, null);
  }
  dist.set(start, 0);

  const pq = new MinHeap();
  pq.push(start, 0);

  while (pq.size > 0) {
    const { node: u } = pq.pop()!;
    if (visited.has(u)) continue;
    visited.add(u);
    visitedOrder.push(u);

    if (u === end) break;

    for (const { neighbor, weight, distance } of adj.get(u) || []) {
      if (visited.has(neighbor)) continue;
      const alt = dist.get(u)! + weight;
      if (alt < dist.get(neighbor)!) {
        dist.set(neighbor, alt);
        distKm.set(neighbor, distKm.get(u)! + distance);
        prev.set(neighbor, u);
        pq.push(neighbor, alt);
      }
    }
  }

  const path: string[] = [];
  let current: string | null = end;
  while (current) {
    path.unshift(current);
    current = prev.get(current) || null;
  }

  const executionTime = performance.now() - t0;

  return {
    path: path[0] === start ? path : [],
    totalCost: dist.get(end) ?? Infinity,
    totalDistance: Math.round((distKm.get(end) ?? 0) * 10) / 10,
    nodesVisited: visited.size,
    executionTime: Math.round(executionTime * 100) / 100,
    algorithm: 'dijkstra',
    visitedOrder,
  };
}

// Greedy Best-First Search using Euclidean distance heuristic
export function greedyBestFirst(graph: CityGraph, start: string, end: string): PathResult {
  const t0 = performance.now();
  const adj = buildAdjacencyList(graph);
  const endNode = graph.nodes.find(n => n.id === end)!;

  const heuristic = (nodeId: string) => {
    const node = graph.nodes.find(n => n.id === nodeId)!;
    return Math.sqrt((node.x - endNode.x) ** 2 + (node.y - endNode.y) ** 2);
  };

  const visited = new Set<string>();
  const visitedOrder: string[] = [];
  const prev = new Map<string, string | null>();
  const costSoFar = new Map<string, number>();
  const distSoFar = new Map<string, number>();

  const pq = new MinHeap();
  pq.push(start, heuristic(start));
  prev.set(start, null);
  costSoFar.set(start, 0);
  distSoFar.set(start, 0);

  while (pq.size > 0) {
    const { node: u } = pq.pop()!;
    if (visited.has(u)) continue;
    visited.add(u);
    visitedOrder.push(u);

    if (u === end) break;

    for (const { neighbor, weight, distance } of adj.get(u) || []) {
      if (visited.has(neighbor)) continue;
      if (!prev.has(neighbor)) {
        prev.set(neighbor, u);
        costSoFar.set(neighbor, (costSoFar.get(u) || 0) + weight);
        distSoFar.set(neighbor, (distSoFar.get(u) || 0) + distance);
        pq.push(neighbor, heuristic(neighbor));
      }
    }
  }

  const path: string[] = [];
  let current: string | null = end;
  while (current) {
    path.unshift(current);
    current = prev.get(current) || null;
  }

  const executionTime = performance.now() - t0;

  return {
    path: path[0] === start ? path : [],
    totalCost: costSoFar.get(end) ?? Infinity,
    totalDistance: Math.round((distSoFar.get(end) ?? 0) * 10) / 10,
    nodesVisited: visited.size,
    executionTime: Math.round(executionTime * 100) / 100,
    algorithm: 'greedy',
    visitedOrder,
  };
}
