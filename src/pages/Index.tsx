import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CityGraph, TrafficLevel, PathResult, Ambulance, Emergency } from '@/lib/types';
import { generateCityGraph, updateTrafficLevels, randomizeTraffic, tickTraffic } from '@/lib/graphEngine';
import { dijkstra, greedyBestFirst } from '@/lib/algorithms';
import GraphVisualization from '@/components/GraphVisualization';
import AlgorithmComparison from '@/components/AlgorithmComparison';
import EmergencyPanel from '@/components/EmergencyPanel';
import AmbulanceList from '@/components/AmbulanceList';
import TrafficControls from '@/components/TrafficControls';
import StatsBar from '@/components/StatsBar';

const EMERGENCY_TYPES = ['Cardiac Arrest', 'Road Accident', 'Stroke', 'Burns', 'Fracture', 'Breathing Difficulty'];
const NAMES = ['Rohit Kumar', 'Priya Sharma', 'Anil Verma', 'Meena Patel', 'Suresh Nair', 'Deepa Reddy'];

const INITIAL_AMBULANCES: Ambulance[] = [
  { id: 'AMB-101', name: 'Ambulance 101', currentNode: 'N0', state: 'available' },
  { id: 'AMB-102', name: 'Ambulance 102', currentNode: 'N15', state: 'available' },
  { id: 'AMB-103', name: 'Ambulance 103', currentNode: 'N10', state: 'available' },
  { id: 'AMB-104', name: 'Ambulance 104', currentNode: 'N25', state: 'available' },
];

const Index: React.FC = () => {
  const [graph, setGraph] = useState<CityGraph>(() => generateCityGraph());
  const [trafficLevel, setTrafficLevel] = useState<TrafficLevel>('medium');
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(null);
  const [dijkstraResult, setDijkstraResult] = useState<PathResult | null>(null);
  const [greedyResult, setGreedyResult] = useState<PathResult | null>(null);
  const [ambulances, setAmbulances] = useState<Ambulance[]>(INITIAL_AMBULANCES);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [currentEmergency, setCurrentEmergency] = useState<Emergency | null>(null);
  const [selectionMode, setSelectionMode] = useState<'start' | 'end'>('start');
  const [dynamicTraffic, setDynamicTraffic] = useState(true);

  // Dynamic traffic: auto-tick every 3 seconds
  useEffect(() => {
    if (!dynamicTraffic) return;
    const interval = setInterval(() => {
      setGraph(prev => tickTraffic(prev, 0.12));
    }, 3000);
    return () => clearInterval(interval);
  }, [dynamicTraffic]);

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
    } else {
      setSelectedEnd(nodeId);
      setSelectionMode('start');
      // Run both algorithms
      const dResult = dijkstra(graph, selectedStart!, nodeId);
      const gResult = greedyBestFirst(graph, selectedStart!, nodeId);
      setDijkstraResult(dResult);
      setGreedyResult(gResult);
    }
  }, [selectionMode, selectedStart, graph]);

  const handleTrafficChange = useCallback((level: TrafficLevel) => {
    setTrafficLevel(level);
    setGraph(prev => updateTrafficLevels(prev, level));
    setDijkstraResult(null);
    setGreedyResult(null);
  }, []);

  const handleRandomize = useCallback(() => {
    setGraph(prev => randomizeTraffic(prev));
    setDijkstraResult(null);
    setGreedyResult(null);
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
    };
    setCurrentEmergency(emergency);
    setSelectedEnd(patientNode.id);
    setSelectionMode('start');
  }, [graph]);

  const handleAcceptEmergency = useCallback(() => {
    if (!currentEmergency) return;
    // Find nearest available ambulance
    const available = ambulances.filter(a => a.state === 'available');
    if (available.length === 0) return;

    // Use dijkstra to find closest ambulance
    let bestAmb = available[0];
    let bestCost = Infinity;
    let bestResult: PathResult | null = null;

    for (const amb of available) {
      const result = dijkstra(graph, amb.currentNode, currentEmergency.patientNode);
      if (result.totalCost < bestCost) {
        bestCost = result.totalCost;
        bestAmb = amb;
        bestResult = result;
      }
    }

    const gResult = greedyBestFirst(graph, bestAmb.currentNode, currentEmergency.patientNode);

    setSelectedStart(bestAmb.currentNode);
    setSelectedEnd(currentEmergency.patientNode);
    setDijkstraResult(bestResult);
    setGreedyResult(gResult);

    const updatedEmergency: Emergency = {
      ...currentEmergency,
      status: 'in-progress',
      assignedAmbulance: bestAmb.id,
      dijkstraResult: bestResult!,
      greedyResult: gResult,
    };

    setCurrentEmergency(updatedEmergency);
    setAmbulances(prev => prev.map(a => a.id === bestAmb.id ? { ...a, state: 'en-route', assignedEmergency: currentEmergency.id } : a));
    setEmergencies(prev => [...prev, updatedEmergency]);

    // Auto-resolve after 5 seconds
    setTimeout(() => {
      setCurrentEmergency(prev => prev ? { ...prev, status: 'resolved' } : null);
      setAmbulances(prev => prev.map(a => a.id === bestAmb.id ? { ...a, state: 'available', assignedEmergency: undefined } : a));
      setEmergencies(prev => prev.map(e => e.id === updatedEmergency.id ? { ...e, status: 'resolved' } : e));
    }, 5000);
  }, [currentEmergency, ambulances, graph]);

  const handleRejectEmergency = useCallback(() => {
    setCurrentEmergency(null);
    setSelectedEnd(null);
  }, []);

  const handleRegenerate = useCallback(() => {
    setGraph(generateCityGraph());
    setSelectedStart(null);
    setSelectedEnd(null);
    setDijkstraResult(null);
    setGreedyResult(null);
    setCurrentEmergency(null);
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
                <span className="font-mono-tech text-emergency-green font-bold">
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
              <p>• Algorithm: <span className="text-emergency-green font-mono-tech">Dijkstra + Greedy BFS</span></p>
              <p>• Nodes: <span className="text-foreground font-mono-tech">{graph.nodes.length}</span></p>
              <p>• Edges: <span className="text-foreground font-mono-tech">{graph.edges.length}</span></p>
            </div>
          </div>

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
              onNodeClick={handleNodeClick}
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
            <EmergencyPanel
              emergency={currentEmergency}
              onAccept={handleAcceptEmergency}
              onReject={handleRejectEmergency}
            />
          )}

          <AlgorithmComparison dijkstra={dijkstraResult} greedy={greedyResult} />

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
                  <span className="text-muted-foreground">Route Safety</span>
                  <p className="font-mono-tech text-emergency-green text-lg font-bold">✓ OPTIMAL</p>
                </div>
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground">Priority</span>
                  <p className="font-mono-tech text-primary text-lg font-bold">HIGH</p>
                </div>
              </div>
              <button className="w-full mt-3 red-bar text-primary-foreground font-orbitron text-xs py-2.5 rounded font-bold tracking-wider hover:opacity-90 transition-opacity">
                ▶▶ NAVIGATE ROUTE ▶
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
