import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CityGraph, PathResult } from '@/lib/types';
import { useSharedTraffic } from '@/hooks/useSharedTraffic';
import { dijkstra, greedyBestFirst, astar } from '@/lib/algorithms';
import GraphVisualization from '@/components/GraphVisualization';
import AlgorithmComparison from '@/components/AlgorithmComparison';
import LiveEtaCountdown from '@/components/LiveEtaCountdown';
import { getPriorityInfo } from '@/lib/priorities';

const DriverDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const graph = useSharedTraffic();
  const [myAmbulance, setMyAmbulance] = useState<any>(null);

  // Start ambulance animation
  const startAnimation = useCallback((path: string[]) => {
    if (animRef.current) clearInterval(animRef.current);
    if (path.length < 2) return;
    setAmbulanceAnim({ nodeIndex: 0, progress: 0 });
    animRef.current = setInterval(() => {
      setAmbulanceAnim(prev => {
        if (!prev) return null;
        let { nodeIndex, progress } = prev;
        progress += 0.015;
        if (progress >= 1) { nodeIndex++; progress = 0; }
        if (nodeIndex >= path.length - 1) {
          if (animRef.current) clearInterval(animRef.current);
          return null;
        }
        return { nodeIndex, progress };
      });
    }, 50);
  }, []);

  // Recalculate route when traffic changes (but keep hospital fixed)
  useEffect(() => {
    if (!activeCaseId || !myAmbulance) return;
    const activeCase = assignedCases.find(c => c.emergency_id === activeCaseId);
    if (!activeCase?.emergency) return;

    const start = myAmbulance.current_node;
    const end = routeTarget === 'patient'
      ? activeCase.emergency.patient_node
      : fixedHospital ?? activeCase.emergency.patient_node;

    const dResult = dijkstra(graph, start, end);
    const gResult = greedyBestFirst(graph, start, end);
    const aResult = astar(graph, start, end);
    setDijkstraResult(dResult);
    setGreedyResult(gResult);
    setAstarResult(aResult);

    // Start animation only ONCE per phase (patient or hospital)
    if (!animStartedRef.current) {
      const bestPath = [dResult, gResult, aResult].reduce((a, b) => a.totalCost <= b.totalCost ? a : b);
      if (bestPath.path.length >= 2) {
        startAnimation(bestPath.path);
        animStartedRef.current = true;
      }
    }

    const priority = getPriorityInfo(activeCase.emergency.case_type);
    const etaMinutes = dResult.totalCost / 60;
    setOnTime(etaMinutes <= priority.responseTimeMax);
  }, [graph, activeCaseId, myAmbulance, routeTarget, assignedCases, fixedHospital]);

  function findNearestHospital(g: CityGraph, fromNode: string): string {
    const hospitals = g.nodes.filter(n => n.type === 'hospital');
    if (hospitals.length === 0) return fromNode;
    let best = hospitals[0].id;
    let bestCost = Infinity;
    for (const h of hospitals) {
      const r = dijkstra(g, fromNode, h.id);
      if (r.totalCost < bestCost) { bestCost = r.totalCost; best = h.id; }
    }
    return best;
  }

  // Fetch ambulance and assignments
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: ambulances, error: ambError } = await supabase
        .from('ambulances')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

      if (ambError || !ambulances || ambulances.length === 0) {
        setMyAmbulance(null);
        setAssignedCases([]);
        return;
      }

      const statusRank: Record<string, number> = { 'en-route': 0, assigned: 1, available: 2, completed: 3 };
      const primaryAmbulance = [...ambulances].sort((a, b) => (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99))[0];
      setMyAmbulance(primaryAmbulance);

      const ambulanceIds = ambulances.map(a => a.id);
      const { data: assignments } = await supabase
        .from('emergency_assignments')
        .select('*, emergency:emergencies(*)')
        .in('ambulance_id', ambulanceIds)
        .order('assigned_at', { ascending: false })
        .limit(20);
      if (assignments) setAssignedCases(assignments as any[]);
    };
    fetchData();

    const channel = supabase
      .channel('driver-assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_assignments' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergencies' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleAccept = async (assignmentId: string, emergencyId: string) => {
    await supabase.from('emergency_assignments').update({ action: 'accepted', responded_at: new Date().toISOString() }).eq('id', assignmentId);
    await supabase.from('emergencies').update({ status: 'accepted' }).eq('id', emergencyId);
    if (myAmbulance) {
      await supabase.from('ambulances').update({ status: 'en-route', cases_handled: (myAmbulance.cases_handled ?? 0) + 1 }).eq('id', myAmbulance.id);
    }
    // Lock the nearest hospital based on patient location at accept time
    const activeEmergency = assignedCases.find(c => c.emergency_id === emergencyId)?.emergency;
    if (activeEmergency) {
      setFixedHospital(findNearestHospital(graph, activeEmergency.patient_node));
    }
    setActiveCaseId(emergencyId);
    setRouteTarget('patient');
    animStartedRef.current = false;
  };

  const handleReject = async (assignmentId: string, emergencyId: string) => {
    await supabase.from('emergency_assignments').update({ action: 'rejected', responded_at: new Date().toISOString() }).eq('id', assignmentId);
    if (myAmbulance) {
      await supabase.from('ambulances').update({ cases_rejected: (myAmbulance.cases_rejected ?? 0) + 1 }).eq('id', myAmbulance.id);
    }
  };

  const handlePass = async (assignmentId: string) => {
    await supabase.from('emergency_assignments').update({ action: 'passed', responded_at: new Date().toISOString() }).eq('id', assignmentId);
  };

  const handleReachedPatient = async () => {
    // Update ambulance location to patient's node
    const activeEmergency = assignedCases.find(c => c.emergency_id === activeCaseId)?.emergency;
    if (myAmbulance && activeEmergency) {
      await supabase.from('ambulances').update({ current_node: activeEmergency.patient_node }).eq('id', myAmbulance.id);
      setMyAmbulance((prev: any) => prev ? { ...prev, current_node: activeEmergency.patient_node } : prev);
    }
    setRouteTarget('hospital');
    setAmbulanceAnim(null);
    animStartedRef.current = false;
    if (animRef.current) clearInterval(animRef.current);
  };

  const handleResolved = async () => {
    if (!activeCaseId) return;
    await supabase.from('emergencies').update({ status: 'resolved' }).eq('id', activeCaseId);
    if (myAmbulance) {
      await supabase.from('ambulances').update({ status: 'available' }).eq('id', myAmbulance.id);
    }
    setActiveCaseId(null);
    setFixedHospital(null);
    setDijkstraResult(null);
    setGreedyResult(null);
    setAstarResult(null);
    setOnTime(null);
    setAmbulanceAnim(null);
    animStartedRef.current = false;
    if (animRef.current) clearInterval(animRef.current);
  };

  const pendingCases = assignedCases.filter(c => c.action === 'pending');
  const activeCase = assignedCases.find(c => c.emergency_id === activeCaseId);

  return (
    <div className="min-h-screen bg-background">
      <header className="red-bar py-3 px-6 flex items-center justify-between">
        <h1 className="font-orbitron text-primary-foreground text-sm md:text-lg font-bold tracking-widest text-glow-red">
          🚑 DRIVER DASHBOARD
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-primary-foreground/80 text-xs font-mono-tech">
            {myAmbulance?.name ?? 'No ambulance assigned'}
          </span>
          <button onClick={signOut} className="bg-secondary/30 text-primary-foreground font-orbitron text-xs px-3 py-1 rounded hover:bg-secondary/50">
            LOGOUT
          </button>
        </div>
      </header>

      {!myAmbulance ? (
        <div className="flex items-center justify-center h-96">
          <div className="panel-gradient border border-border rounded-lg p-8 text-center">
            <p className="font-orbitron text-foreground text-lg mb-2">NO AMBULANCE ASSIGNED</p>
            <p className="text-muted-foreground text-sm">Contact admin to assign you an ambulance.</p>
          </div>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left: Cases & Status */}
          <div className="space-y-4">
            {/* Status */}
            <div className="panel-gradient border border-border rounded-lg p-4">
              <h3 className="font-orbitron text-sm text-foreground mb-2">STATUS</h3>
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">Ambulance: <span className="text-foreground font-mono-tech">{myAmbulance.name}</span></p>
                <p className="text-muted-foreground">Location: <span className="text-foreground font-mono-tech">{myAmbulance.current_node}</span></p>
                <p className="text-muted-foreground">Status: <span className={`font-orbitron font-bold ${myAmbulance.status === 'available' ? 'text-accent' : 'text-emergency-orange'}`}>{myAmbulance.status?.toUpperCase()}</span></p>
                <p className="text-muted-foreground">Cases Handled: <span className="text-foreground font-mono-tech">{myAmbulance.cases_handled}</span></p>
              </div>
            </div>

            {/* Live ETA Countdown */}
            {activeCaseId && dijkstraResult && (
              <LiveEtaCountdown totalCostSeconds={dijkstraResult.totalCost} label={routeTarget === 'patient' ? '→ TO PATIENT' : '→ TO HOSPITAL'} />
            )}

            {/* On-time indicator */}
            {activeCaseId && onTime !== null && (
              <div className={`panel-gradient border rounded-lg p-4 ${onTime ? 'border-accent glow-green' : 'border-primary glow-red'}`}>
                <p className={`font-orbitron text-lg font-bold ${onTime ? 'text-accent' : 'text-primary animate-pulse-emergency'}`}>
                  {onTime ? '✅ ON TIME' : '⚠️ RUNNING LATE'}
                </p>
                {routeTarget === 'patient' && (
                  <button onClick={handleReachedPatient} className="w-full mt-2 bg-accent text-accent-foreground font-orbitron text-xs py-2 rounded font-bold">
                    ✅ REACHED PATIENT → NAVIGATE TO HOSPITAL
                  </button>
                )}
                {routeTarget === 'hospital' && (
                  <button onClick={handleResolved} className="w-full mt-2 bg-accent text-accent-foreground font-orbitron text-xs py-2 rounded font-bold">
                    ✅ CASE RESOLVED
                  </button>
                )}
              </div>
            )}

            {/* Pending cases */}
            <div className="panel-gradient border border-border rounded-lg p-4">
              <h3 className="font-orbitron text-sm text-foreground mb-3">
                🚨 INCOMING CASES ({pendingCases.length})
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {pendingCases.length === 0 && <p className="text-muted-foreground text-xs">No pending cases</p>}
                {pendingCases.map(c => {
                  const em = c.emergency;
                  if (!em) return null;
                  const pInfo = getPriorityInfo(em.case_type);
                  return (
                    <div key={c.id} className="bg-secondary/30 rounded p-3 border border-border">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-orbitron text-xs text-foreground font-bold">{em.case_type}</span>
                        <span className="text-xs font-mono-tech" style={{ color: pInfo.color }}>
                          P{pInfo.priority} ({pInfo.responseTimeMin}-{pInfo.responseTimeMax}m)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Patient: {em.patient_name} • Node: {em.patient_node}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleAccept(c.id, em.id)} className="flex-1 bg-accent text-accent-foreground font-orbitron text-xs py-1.5 rounded font-bold">
                          ACCEPT
                        </button>
                        <button onClick={() => handleReject(c.id, em.id)} className="flex-1 bg-primary text-primary-foreground font-orbitron text-xs py-1.5 rounded font-bold">
                          REJECT
                        </button>
                        <button onClick={() => handlePass(c.id)} className="flex-1 bg-secondary text-secondary-foreground font-orbitron text-xs py-1.5 rounded font-bold">
                          PASS
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Algorithm comparison */}
            {dijkstraResult && <AlgorithmComparison dijkstra={dijkstraResult} greedy={greedyResult} astar={astarResult} />}
          </div>

          {/* Center: Map */}
          <div className="lg:col-span-3">
            <div className="panel-gradient border border-border rounded-lg p-2 h-[600px]">
              <div className="flex items-center justify-between px-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-xs font-orbitron text-accent">LIVE TRAFFIC + HEATMAP</span>
                  <span className="text-xs text-muted-foreground font-mono-tech">Reroutes every 3s</span>
                </div>
                {dijkstraResult && (
                  <div className="text-xs font-mono-tech text-muted-foreground">
                    D: <span className="text-emergency-green font-bold">{dijkstraResult.totalCost}s</span>
                    {greedyResult && <> | G: <span className="text-emergency-yellow font-bold">{greedyResult.totalCost}s</span></>}
                    {astarResult && <> | A*: <span className="text-emergency-blue font-bold">{astarResult.totalCost}s</span></>}
                  </div>
                )}
              </div>
              <GraphVisualization
                graph={graph}
                selectedStart={myAmbulance?.current_node ?? null}
                selectedEnd={activeCase?.emergency?.patient_node ?? null}
                pathResult={dijkstraResult}
                secondaryPath={greedyResult}
                tertiaryPath={astarResult}
                onNodeClick={() => {}}
                ambulancePosition={ambulanceAnim}
                showHeatmap={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
