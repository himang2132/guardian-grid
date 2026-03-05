// Graph types for the Emergency Ambulance Response System

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'junction' | 'hospital' | 'station';
}

export interface GraphEdge {
  from: string;
  to: string;
  baseWeight: number; // base travel time in seconds
  distance: number; // km
  trafficLevel: 'low' | 'medium' | 'high';
  directed?: boolean; // true = one-way from→to
  blocked?: boolean; // true = road closed
}

export interface CityGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PathResult {
  path: string[];
  totalCost: number;
  totalDistance: number;
  nodesVisited: number;
  executionTime: number;
  algorithm: 'dijkstra' | 'greedy' | 'astar';
  visitedOrder: string[];
}

export type TrafficLevel = 'low' | 'medium' | 'high';

export interface Ambulance {
  id: string;
  name: string;
  currentNode: string;
  state: 'available' | 'assigned' | 'en-route' | 'completed';
  assignedEmergency?: string;
}

export interface Emergency {
  id: string;
  patientNode: string;
  patientName: string;
  age: number;
  emergencyType: string;
  timestamp: number;
  status: 'pending' | 'in-progress' | 'resolved';
  assignedAmbulance?: string;
  dijkstraResult?: PathResult;
  greedyResult?: PathResult;
  astarResult?: PathResult;
  selectedAlgorithm?: 'dijkstra' | 'greedy' | 'astar';
  escalationLevel?: number; // 0=normal, 1=elevated, 2=critical broadcast
  escalatedAt?: number;
}

export interface AnalyticsEntry {
  timestamp: number;
  emergencyId: string;
  caseType: string;
  dijkstraCost: number;
  greedyCost: number;
  astarCost: number;
  dijkstraDistance: number;
  greedyDistance: number;
  astarDistance: number;
  winner: 'dijkstra' | 'greedy' | 'astar';
  responseTimeSec: number;
  onTime: boolean;
}
