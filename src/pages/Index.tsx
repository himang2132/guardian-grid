import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CityGraph, TrafficLevel, PathResult, Ambulance, Emergency, AnalyticsEntry } from '@/lib/types';
import { updateTrafficLevels, randomizeTraffic, tickTraffic } from '@/lib/graphEngine';
import { BASE_CITY_GRAPH } from '@/lib/sharedGraph';
import { dijkstra, greedyBestFirst, astar } from '@/lib/algorithms';
import { getPriorityInfo } from '@/lib/priorities';
import GraphVisualization from '@/components/GraphVisualization';
import AlgorithmComparison from '@/components/AlgorithmComparison';
import EmergencyPanel from '@/components/EmergencyPanel';
import AmbulanceList from '@/components/AmbulanceList';
import TrafficControls from '@/components/TrafficControls';
import StatsBar from '@/components/StatsBar';
import LiveEtaCountdown from '@/components/LiveEtaCountdown';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';

const EMERGENCY_TYPES = ['Cardiac Arrest', 'Road Accident', 'Stroke', 'Burns', 'Fracture', 'Breathing Difficulty'];
const NAMES = ['Rohit Kumar', 'Priya Sharma', 'Anil Verma', 'Meena Patel', 'Suresh Nair', 'Deepa Reddy'];

const INITIAL_AMBULANCES: Ambulance[] = [
  { id: 'AMB-101', name: 'Ambulance 101', currentNode: 'N0', state: 'available' },
  { id: 'AMB-102', name: 'Ambulance 102', currentNode: 'N20', state: 'available' },
  { id: 'AMB-103', name: 'Ambulance 103', currentNode: 'N35', state: 'available' },
  { id: 'AMB-104', name: 'Ambulance 104', currentNode: 'N48', state: 'available' },
];

const ESCALATION_TIMEOUT_MS = 15000; // 15s before escalation

const Index: React.FC = () => {
  const [graph, setGraph] = useState<CityGraph>(() => ({ ...BASE_CITY_GRAPH, edges: BASE_CITY_GRAPH.edges.map(e => ({ ...e })) }));
  const [trafficLevel, setTrafficLevel] = useState<TrafficLevel>('medium');
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(null);
  const [dijkstraResult, setDijkstraResult] = useState<PathResult | null>(null);
  const [greedyResult, setGreedyResult] = useState<PathResult | null>(null);
  const [astarResult, setAstarResult] = useState<PathResult | null>(null);
  const [ambulances, setAmbulances] = useState<Ambulance[]>(INITIAL_AMBULANCES);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [currentEmergency, setCurrentEmergency] = useState<Emergency | null>(null);
  const [selectionMode, setSelectionMode] = useState<'start' | 'end'>('start');
  const [dynamicTraffic, setDynamicTraffic] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsEntry[]>([]);
  const [ambulanceAnim, setAmbulanceAnim] = useState<{ nodeIndex: number; progress: number } | null>(null);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const escalationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dynamic traffic: auto-tick every 3 seconds
  useEffect(() => {
    if (!dynamicTraffic) return;
    const interval = setInterval(() => {
      setGraph(prev => tickTraffic(prev, 0.12));
    }, 3000);
    return () => clearInterval(interval);
  }, [dynamicTraffic]);

  // Recalculate paths when traffic changes dynamically
  useEffect(() => {
    if (selectedStart && selectedEnd) {
      setDijkstraResult(dijkstra(graph, selectedStart, selectedEnd));
      setGreedyResult(greedyBestFirst(graph, selectedStart, selectedEnd));
      setAstarResult(astar(graph, selectedStart, selectedEnd));
    }
  }, [graph, selectedStart, selectedEnd]);

  const totalEmergencies = emergencies.length;
  const activeAmbulances = ambulances.filter(a => a.state !== 'available').length;
  const resolvedCases = emergencies.filter(e => e.status === 'resolved').length;
  const avgResponseTime = useMemo(() => {
    const resolved = emergencies.filter(e => e.dijkstraResult);
    if (resolved.length === 0) return 0;
    return Math.round(resolved.reduce((s, e) => s + (e.dijkstraResult?.totalCost ?? 0), 0) / resolved.length);
  }, [emergencies]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (selectionMode === 'start') {
      setSelectedStart(nodeId);
      setSelectionMode('end');
      setDijkstraResult(null);
      setGreedyResult(null);
      setAstarResult(null);
      setAmbulanceAnim(null);
    } else {
      setSelectedEnd(nodeId);
      setSelectionMode('start');
      const dResult = dijkstra(graph, selectedStart!, nodeId);
      const gResult = greedyBestFirst(graph, selectedStart!, nodeId);
      const aResult = astar(graph, selectedStart!, nodeId);
      setDijkstraResult(dResult);
      setGreedyResult(gResult);
      setAstarResult(aResult);
    }
  }, [selectionMode, selectedStart, graph]);

  const handleTrafficChange = useCallback((level: TrafficLevel) => {
    setTrafficLevel(level);
    setGraph(prev => updateTrafficLevels(prev, level));
  }, []);

  const handleRandomize = useCallback(() => {
    setGraph(prev => randomizeTraffic(prev));
  }, []);

  // Start ambulance animation along path
  const startAmbulanceAnimation = useCallback((path: string[]) => {
    if (animRef.current) clearInterval(animRef.current);
    if (path.length < 2) return;
    setAmbulanceAnim({ nodeIndex: 0, progress: 0 });
    const speed = 0.02; // progress per tick
    animRef.current = setInterval(() => {
      setAmbulanceAnim(prev => {
        if (!prev) return null;
        let { nodeIndex, progress } = prev;
        progress += speed;
        if (progress >= 1) {
          nodeIndex++;
          progress = 0;
        }
        if (nodeIndex >= path.length - 1) {
          if (animRef.current) clearInterval(animRef.current);
          return null;
        }
        return { nodeIndex, progress };
      });
    }, 50);
  }, []);

  // Auto-escalation logic
  const startEscalation = useCallback((emergency: Emergency) => {
    if (escalationRef.current) clearTimeout(escalationRef.current);
    escalationRef.current = setTimeout(() => {
      setCurrentEmergency(prev => {
        if (prev && prev.id === emergency.id && prev.status === 'pending') {
          const escalated = { ...prev, escalationLevel: (prev.escalationLevel ?? 0) + 1, escalatedAt: Date.now() };
          // Level 2 = broadcast to all
          if (escalated.escalationLevel! >= 2) {
            // Auto-accept with nearest ambulance
            return escalated;
          }
          // Schedule next escalation
          startEscalation(escalated);
          return escalated;
        }
        return prev;
      });
    }, ESCALATION_TIMEOUT_MS);
  }, []);

  const handleNewEmergency = useCallback(() => {
    const nodes = graph.nodes;
    const patientNode = nodes[Math.floor(Math.random() * nodes.length)];
    const emergency: Emergency = {
      id: `EMG-${Date.now()}`,
      patientNode: patientNode.id,
      patientName: NAMES[Math.floor(Math.random() * NAMES.length)],
      age: 20 + Math.floor(Math.random() * 60),
      emergencyType: EMERGENCY_TYPES[Math.floor(Math.random() * EMERGENCY_TYPES.length)],
      timestamp: Date.now(),
      status: 'pending',
      escalationLevel: 0,
    };
    setCurrentEmergency(emergency);
    setSelectedEnd(patientNode.id);
    setSelectionMode('start');
    startEscalation(emergency);
  }, [graph, startEscalation]);

  // Multi-ambulance dispatch optimization: find THE best ambulance across all available
  const handleAcceptEmergency = useCallback(() => {
    if (!currentEmergency) return;
    if (escalationRef.current) clearTimeout(escalationRef.current);
    const available = ambulances.filter(a => a.state === 'available');
    if (available.length === 0) return;

    // Find optimal ambulance (minimum cost across all three algorithms)
    let bestAmb = available[0];
    let bestCost = Infinity;
    let bestDijkstra: PathResult | null = null;
    let bestGreedy: PathResult | null = null;
    let bestAstar: PathResult | null = null;

    for (const amb of available) {
      const dResult = dijkstra(graph, amb.currentNode, currentEmergency.patientNode);
      const gResult = greedyBestFirst(graph, amb.currentNode, currentEmergency.patientNode);
      const aResult = astar(graph, amb.currentNode, currentEmergency.patientNode);
      // Use minimum of all three as the true best
      const minCost = Math.min(dResult.totalCost, gResult.totalCost, aResult.totalCost);
      if (minCost < bestCost) {
        bestCost = minCost;
        bestAmb = amb;
        bestDijkstra = dResult;
        bestGreedy = gResult;
        bestAstar = aResult;
      }
    }

    setSelectedStart(bestAmb.currentNode);
    setSelectedEnd(currentEmergency.patientNode);
    setDijkstraResult(bestDijkstra);
    setGreedyResult(bestGreedy);
    setAstarResult(bestAstar);

    // Determine winner algorithm
    const costs = [
      { algo: 'dijkstra' as const, cost: bestDijkstra?.totalCost ?? Infinity },
      { algo: 'greedy' as const, cost: bestGreedy?.totalCost ?? Infinity },
      { algo: 'astar' as const, cost: bestAstar?.totalCost ?? Infinity },
    ];
    const winner = costs.reduce((a, b) => a.cost <= b.cost ? a : b);
    const winnerPath = winner.algo === 'dijkstra' ? bestDijkstra : winner.algo === 'astar' ? bestAstar : bestGreedy;

    // Start ambulance animation on the winning path
    if (winnerPath?.path && winnerPath.path.length >= 2) {
      startAmbulanceAnimation(winnerPath.path);
    }

    const pInfo = getPriorityInfo(currentEmergency.emergencyType);
    const onTime = (bestDijkstra?.totalCost ?? Infinity) / 60 <= pInfo.responseTimeMax;

    // Record analytics
    const entry: AnalyticsEntry = {
      timestamp: Date.now(),
      emergencyId: currentEmergency.id,
      caseType: currentEmergency.emergencyType,
      dijkstraCost: bestDijkstra?.totalCost ?? 0,
      greedyCost: bestGreedy?.totalCost ?? 0,
      astarCost: bestAstar?.totalCost ?? 0,
      dijkstraDistance: bestDijkstra?.totalDistance ?? 0,
      greedyDistance: bestGreedy?.totalDistance ?? 0,
      astarDistance: bestAstar?.totalDistance ?? 0,
      winner: winner.algo,
      responseTimeSec: bestCost,
      onTime,
    };
    setAnalyticsData(prev => [...prev, entry]);

    const updatedEmergency: Emergency = {
      ...currentEmergency,
      status: 'in-progress',
      assignedAmbulance: bestAmb.id,
      dijkstraResult: bestDijkstra!,
      greedyResult: bestGreedy!,
      astarResult: bestAstar!,
      selectedAlgorithm: winner.algo,
    };

    setCurrentEmergency(updatedEmergency);
    setAmbulances(prev => prev.map(a => a.id === bestAmb.id ? { ...a, state: 'en-route', assignedEmergency: currentEmergency.id } : a));
    setEmergencies(prev => [...prev, updatedEmergency]);

    // Auto-resolve after animation completes (~path length * 50ms per segment / speed)
    const animDuration = Math.max(5000, (winnerPath?.path?.length ?? 5) * 2500);
    setTimeout(() => {
      setCurrentEmergency(prev => prev ? { ...prev, status: 'resolved' } : null);
      setAmbulances(prev => prev.map(a => a.id === bestAmb.id ? { ...a, state: 'available', assignedEmergency: undefined } : a));
      setEmergencies(prev => prev.map(e => e.id === updatedEmergency.id ? { ...e, status: 'resolved' } : e));
      setAmbulanceAnim(null);
    }, animDuration);
  }, [currentEmergency, ambulances, graph, startAmbulanceAnimation]);

  const handleRejectEmergency = useCallback(() => {
    if (escalationRef.current) clearTimeout(escalationRef.current);
    setCurrentEmergency(null);
    setSelectedEnd(null);
    setAmbulanceAnim(null);
  }, []);

  const handleRegenerate = useCallback(() => {
    if (animRef.current) clearInterval(animRef.current);
    if (escalationRef.current) clearTimeout(escalationRef.current);
    setGraph({ ...BASE_CITY_GRAPH, edges: BASE_CITY_GRAPH.edges.map(e => ({ ...e })) });
    setSelectedStart(null);
    setSelectedEnd(null);
    setDijkstraResult(null);
    setGreedyResult(null);
    setAstarResult(null);
    setCurrentEmergency(null);
    setAmbulanceAnim(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top red bar */}
      <header className="red-bar py-3 px-6">
        <h1 className="font-orbitron text-primary-foreground text-lg md:text-xl font-bold tracking-widest text-center text-glow-red">
          EMERGENCY AMBULANCE RESPONSE SYSTEM
        </h1>
      </header>

      {/* Info bar */}
      <div className="bg-card border-b border-border px-6 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">🚑 Current Location:</span>
            <span className="font-mono-tech text-foreground font-bold">{selectedStart ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">📍 Patient Location:</span>
            <span className="font-mono-tech text-foreground font-bold">{selectedEnd ?? '—'}</span>
          </div>
          {dijkstraResult && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">⏱️ ETA:</span>
                <span className="font-mono-tech text-accent font-bold">
                  {Math.floor(dijkstraResult.totalCost / 60)}m {dijkstraResult.totalCost % 60}s
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">📏 Distance:</span>
                <span className="font-mono-tech text-emergency-blue font-bold">{dijkstraResult.totalDistance} km</span>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-orbitron ${selectionMode === 'start' ? 'bg-emergency-blue/20 text-emergency-blue' : 'bg-primary/20 text-primary'}`}>
            Select: {selectionMode === 'start' ? 'AMBULANCE' : 'PATIENT'}
          </span>
          <button
            onClick={() => setShowAnalytics(a => !a)}
            className={`px-3 py-0.5 rounded text-xs font-orbitron font-bold transition-colors ${showAnalytics ? 'bg-emergency-blue/20 text-emergency-blue' : 'bg-secondary text-muted-foreground'}`}
          >
            📊 ANALYTICS
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-3">
        <StatsBar
          totalEmergencies={totalEmergencies}
          activeAmbulances={activeAmbulances}
          avgResponseTime={avgResponseTime}
          resolvedCases={resolvedCases}
        />
      </div>

      {/* Analytics Dashboard */}
      {showAnalytics && (
        <div className="px-6 pb-4">
          <AnalyticsDashboard entries={analyticsData} />
        </div>
      )}

      {/* Main content */}
      <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left sidebar */}
        <div className="space-y-4">
          <TrafficControls currentLevel={trafficLevel} onSetLevel={handleTrafficChange} onRandomize={handleRandomize} />
          
          {/* Dynamic traffic toggle */}
          <div className="panel-gradient border border-border rounded-lg p-3 flex items-center justify-between">
            <span className="font-orbitron text-xs text-foreground">⚡ LIVE TRAFFIC</span>
            <button
              onClick={() => setDynamicTraffic(d => !d)}
              className={`px-3 py-1 rounded text-xs font-orbitron font-bold transition-all ${
                dynamicTraffic ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {dynamicTraffic ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div className="panel-gradient border border-border rounded-lg p-4">
            <h3 className="font-orbitron text-sm text-foreground mb-3">ROUTE CALCULATION</h3>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p>• Algorithms: <span className="text-accent font-mono-tech">Dijkstra + Greedy + A*</span></p>
              <p>• Nodes: <span className="text-foreground font-mono-tech">{graph.nodes.length}</span></p>
              <p>• Edges: <span className="text-foreground font-mono-tech">{graph.edges.length}</span></p>
              <p>• One-way: <span className="text-emergency-blue font-mono-tech">{graph.edges.filter(e => e.directed).length}</span></p>
              <p>• Closed: <span className="text-primary font-mono-tech">{graph.edges.filter(e => e.blocked).length}</span></p>
            </div>
          </div>

          {/* Live ETA Countdown */}
          {dijkstraResult && currentEmergency?.status === 'in-progress' && (
            <LiveEtaCountdown totalCostSeconds={dijkstraResult.totalCost} label="⏱️ LIVE ETA" />
          )}

          <AmbulanceList ambulances={ambulances} />
        </div>

        {/* Center - Graph */}
        <div className="lg:col-span-2">
          <div className="panel-gradient border border-border rounded-lg p-2 h-full">
            <GraphVisualization
              graph={graph}
              selectedStart={selectedStart}
              selectedEnd={selectedEnd}
              pathResult={dijkstraResult}
              secondaryPath={greedyResult}
              tertiaryPath={astarResult}
              onNodeClick={handleNodeClick}
              ambulancePosition={ambulanceAnim}
              showHeatmap={true}
            />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={handleNewEmergency} className="flex-1 red-bar text-primary-foreground font-orbitron text-xs py-2.5 rounded font-bold tracking-wider hover:opacity-90 transition-opacity animate-pulse-emergency">
              🚨 NEW EMERGENCY
            </button>
            <button onClick={handleRegenerate} className="bg-secondary text-secondary-foreground font-orbitron text-xs py-2.5 px-3 rounded font-bold hover:bg-secondary/80 transition-colors">
              🔄
            </button>
          </div>

          {currentEmergency && (
            <>
              <EmergencyPanel
                emergency={currentEmergency}
                onAccept={handleAcceptEmergency}
                onReject={handleRejectEmergency}
              />
              {/* Escalation indicator */}
              {currentEmergency.escalationLevel !== undefined && currentEmergency.escalationLevel > 0 && currentEmergency.status === 'pending' && (
                <div className={`panel-gradient border rounded-lg p-3 text-center ${
                  currentEmergency.escalationLevel >= 2 ? 'border-primary glow-red animate-pulse-emergency' : 'border-emergency-orange'
                }`}>
                  <p className="font-orbitron text-xs text-foreground">
                    ⚠️ ESCALATION LEVEL {currentEmergency.escalationLevel}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentEmergency.escalationLevel >= 2 ? 'BROADCASTING TO ALL UNITS' : 'Response overdue — escalating...'}
                  </p>
                </div>
              )}
            </>
          )}

          <AlgorithmComparison dijkstra={dijkstraResult} greedy={greedyResult} astar={astarResult} />

          {/* Route summary */}
          {dijkstraResult && (
            <div className="panel-gradient border border-border rounded-lg p-4">
              <h3 className="font-orbitron text-sm text-foreground mb-2">ROUTE SUMMARY</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground">Total Distance</span>
                  <p className="font-mono-tech text-foreground text-lg font-bold">{dijkstraResult.totalDistance} km</p>
                </div>
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground">Expected Time</span>
                  <p className="font-mono-tech text-foreground text-lg font-bold">
                    {Math.floor(dijkstraResult.totalCost / 60)}m {dijkstraResult.totalCost % 60}s
                  </p>
                </div>
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground">Best Algorithm</span>
                  <p className="font-mono-tech text-accent text-lg font-bold">
                    {currentEmergency?.selectedAlgorithm?.toUpperCase() ?? 'DIJKSTRA'}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground">Road Features</span>
                  <p className="font-mono-tech text-emergency-blue text-sm font-bold">
                    {graph.edges.filter(e => e.directed).length}↗ {graph.edges.filter(e => e.blocked).length}✕
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
