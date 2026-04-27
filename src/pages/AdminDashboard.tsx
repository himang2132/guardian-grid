import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CityGraph, AnalyticsEntry } from '@/lib/types';
import { useSharedTraffic } from '@/hooks/useSharedTraffic';
import { dijkstra, greedyBestFirst, astar } from '@/lib/algorithms';
import GraphVisualization from '@/components/GraphVisualization';
import StatsBar from '@/components/StatsBar';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import ThemeToggle from '@/components/ThemeToggle';
import LiveClock from '@/components/LiveClock';
import PageTransition from '@/components/PageTransition';
import { useEmergencySound } from '@/hooks/useEmergencySound';
import { getPriorityInfo } from '@/lib/priorities';
import { downloadCaseReport, CaseReportData } from '@/lib/pdfReport';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

const ESCALATION_TIMEOUT = 20000;

const AdminDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const graph = useSharedTraffic();
  const { playAlert } = useEmergencySound();
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'ambulances' | 'cases' | 'drivers' | 'analytics'>('overview');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsEntry[]>([]);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const prevEmergencyCountRef = useRef(0);

  const fetchAll = useCallback(async () => {
    const [emRes, ambRes, assignRes, profRes, roleRes] = await Promise.all([
      supabase.from('emergencies').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('ambulances').select('*').order('name'),
      supabase.from('emergency_assignments').select('*, emergency:emergencies(*)').order('assigned_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
    ]);
    if (emRes.data) {
      // Play sound for new emergencies
      const pendingCount = emRes.data.filter(e => e.status === 'pending').length;
      if (pendingCount > prevEmergencyCountRef.current && prevEmergencyCountRef.current > 0) {
        playAlert();
        toast.error('🚨 New Emergency Reported!', { description: 'A new case needs dispatch.' });
      }
      prevEmergencyCountRef.current = pendingCount;
      setEmergencies(emRes.data);
    }
    if (ambRes.data) setAmbulances(ambRes.data);
    if (assignRes.data) setAssignments(assignRes.data as any[]);
    if (profRes.data) setProfiles(profRes.data);
    if (roleRes.data) setRoles(roleRes.data);
  }, [playAlert]);

  useEffect(() => {
  if (!user) return; // 🔥 wait for login

  fetchAll();

  const channel = supabase
    .channel('admin-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'emergencies' }, () => fetchAll())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, () => fetchAll())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_assignments' }, () => fetchAll())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user]); // ✅ depend on user

  // Auto-escalation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const pendingOld = emergencies.filter(e =>
        e.status === 'pending' && (now - new Date(e.created_at).getTime() > ESCALATION_TIMEOUT)
      );
      for (const e of pendingOld) {
        handleDispatch(e.id);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [emergencies, ambulances, graph]);

  const handleDispatch = async (emergencyId: string) => {
  const emergency = emergencies.find(e => e.id === emergencyId);
  if (!emergency) return;

  console.log("🚨 Selected Emergency:", emergency);
  console.log("🚑 All Ambulances:", ambulances);
  console.log("🧠 Graph Nodes:", graph.nodes.map(n => n.id));

  const available = ambulances.filter(a => a.status === 'available');
  if (available.length === 0) return;

  let bestAmb = available[0];
  let bestCost = Infinity;

  for (const amb of available) {
    const validStart = graph.nodes.find(n => n.id === amb.current_node)
      ? amb.current_node
      : graph.nodes[0].id;

    const validEnd = graph.nodes.find(n => n.id === emergency.patient_node)
      ? emergency.patient_node
      : graph.nodes[1].id;

    const dResult = dijkstra(graph, validStart, validEnd);
    const gResult = greedyBestFirst(graph, validStart, validEnd);
    const aResult = astar(graph, validStart, validEnd);

    const minCost = Math.min(
      dResult.totalCost,
      gResult.totalCost,
      aResult.totalCost
    );

    if (minCost < bestCost) {
      bestCost = minCost;
      bestAmb = amb;
    }
  }

  // ✅ Recalculate for best ambulance (IMPORTANT)
  const validStart = graph.nodes.find(n => n.id === bestAmb.current_node)
    ? bestAmb.current_node
    : graph.nodes[0].id;

  const validEnd = graph.nodes.find(n => n.id === emergency.patient_node)
    ? emergency.patient_node
    : graph.nodes[1].id;

  console.log("🚑 Selected Ambulance:", bestAmb);
  console.log("📍 Start Node:", validStart);
  console.log("📍 End Node:", validEnd);

  const dResult = dijkstra(graph, validStart, validEnd);
  const gResult = greedyBestFirst(graph, validStart, validEnd);
  const aResult = astar(graph, validStart, validEnd);

  const costs = [
    { algo: 'dijkstra' as const, cost: dResult.totalCost },
    { algo: 'greedy' as const, cost: gResult.totalCost },
    { algo: 'astar' as const, cost: aResult.totalCost },
  ];

  const winner = costs.reduce((a, b) => (a.cost <= b.cost ? a : b));

  const pInfo = getPriorityInfo(emergency.case_type);
  const onTime = bestCost / 60 <= pInfo.responseTimeMax;

  setAnalyticsData(prev => [
    ...prev,
    {
      timestamp: Date.now(),
      emergencyId: emergency.id,
      caseType: emergency.case_type,
      dijkstraCost: dResult.totalCost,
      greedyCost: gResult.totalCost,
      astarCost: aResult.totalCost,
      dijkstraDistance: dResult.totalDistance,
      greedyDistance: gResult.totalDistance,
      astarDistance: aResult.totalDistance,
      winner: winner.algo,
      responseTimeSec: bestCost,
      onTime,
    },
  ]);

  await supabase.from('emergency_assignments').insert([
    {
      emergency_id: emergencyId,
      ambulance_id: bestAmb.id,
      action: 'pending',
      route_data: {
        dijkstra: dResult,
        greedy: gResult,
        astar: aResult,
        winner: winner.algo,
      } as any,
    },
  ]);

  await supabase
    .from('emergencies')
    .update({ status: 'assigned' })
    .eq('id', emergencyId);

  await supabase
    .from('ambulances')
    .update({ status: 'en-route' })
    .eq('id', bestAmb.id);

  toast.success('🚑 Ambulance Dispatched', {
    description: `${bestAmb.name} dispatched to ${emergency.patient_name}`,
  });
};

  const handleAssignDriver = async (ambulanceId: string, driverId: string) => {
    await supabase.from('ambulances').update({ driver_id: driverId }).eq('id', ambulanceId);
    fetchAll();
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('user_roles').insert({ user_id: userId, role: newRole as any });
    fetchAll();
  };

  const totalEmergencies = emergencies.length;
  const activeAmbulances = ambulances.filter(a => a.status !== 'available').length;
  const resolvedCases = emergencies.filter(e => e.status === 'resolved').length;
  const avgResponseTime = analyticsData.length > 0
    ? Math.round(analyticsData.reduce((s, e) => s + e.responseTimeSec, 0) / analyticsData.length)
    : 0;

  const pendingEmergencies = emergencies.filter(e => e.status === 'pending');
  const drivers = roles.filter(r => r.role === 'driver');
  const driverProfiles = profiles.filter(p => drivers.some(d => d.user_id === p.id));

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <header className="red-bar py-3 px-4 md:px-6 flex items-center justify-between">
          <h1 className="font-orbitron text-primary-foreground text-xs sm:text-sm md:text-lg font-bold tracking-widest text-glow-red">
            🛡️ ADMIN CONTROL CENTER
          </h1>
          <div className="flex items-center gap-2 md:gap-3">
            <LiveClock />
            <span className="text-primary-foreground/80 text-xs font-mono-tech hidden sm:inline">{user?.email}</span>
            <ThemeToggle />
            <button onClick={signOut} className="bg-secondary/30 text-primary-foreground font-orbitron text-xs px-3 py-1 rounded hover:bg-secondary/50">
              LOGOUT
            </button>
          </div>
        </header>

        <div className="px-4 md:px-6 py-3">
          <StatsBar
            totalEmergencies={totalEmergencies}
            activeAmbulances={activeAmbulances}
            avgResponseTime={avgResponseTime}
            resolvedCases={resolvedCases}
          />
        </div>

        {/* Tabs */}
        <div className="px-4 md:px-6 flex gap-2 mb-4 flex-wrap">
          {(['overview', 'ambulances', 'cases', 'drivers', 'analytics'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`font-orbitron text-xs px-3 md:px-4 py-2 rounded font-bold transition-colors ${
                tab === t ? 'red-bar text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {t === 'analytics' ? '📊 ' : ''}{t.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="px-4 md:px-6 pb-6">
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="panel-gradient border border-border rounded-lg p-4">
                <h3 className="font-orbitron text-sm text-foreground mb-3">
                  🚨 PENDING DISPATCH ({pendingEmergencies.length})
                </h3>
                <p className="text-xs text-muted-foreground mb-3">Auto-escalation: unaccepted cases auto-dispatch after 20s</p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {pendingEmergencies.map(e => {
                    const pInfo = getPriorityInfo(e.case_type);
                    const age = Date.now() - new Date(e.created_at).getTime();
                    const isOverdue = age > ESCALATION_TIMEOUT;
                    return (
                      <div key={e.id} className={`bg-secondary/30 rounded p-3 border ${isOverdue ? 'border-primary animate-pulse-emergency' : 'border-border'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-orbitron text-xs font-bold text-foreground">{e.case_type}</span>
                            <p className="text-xs text-muted-foreground mt-1">{e.patient_name} • Node: {e.patient_node}</p>
                            {isOverdue && <p className="text-xs text-primary font-orbitron mt-1">⚠️ ESCALATED — AUTO-DISPATCHING</p>}
                          </div>
                          <span className="text-xs font-mono-tech" style={{ color: pInfo.color }}>P{pInfo.priority}</span>
                        </div>
                        <button
                          onClick={() => handleDispatch(e.id)}
                          className="w-full mt-2 bg-accent text-accent-foreground font-orbitron text-xs py-1.5 rounded font-bold"
                        >
                          DISPATCH NEAREST AMBULANCE
                        </button>
                      </div>
                    );
                  })}
                  {pendingEmergencies.length === 0 && <p className="text-muted-foreground text-xs">No pending cases</p>}
                </div>
              </div>

              <div className="lg:col-span-2 panel-gradient border border-border rounded-lg p-2 h-[400px] md:h-[500px]">
                <GraphVisualization
  graph={graph}
  ambulances={ambulances}   // ✅ ADD THIS
  selectedStart={null}
  selectedEnd={null}
  pathResult={null}
  secondaryPath={null}
  onNodeClick={() => {}}
  showHeatmap={true}
/>
              </div>
            </div>
          )}

          {tab === 'ambulances' && (
            <div className="panel-gradient border border-border rounded-lg p-4">
              <h3 className="font-orbitron text-sm text-foreground mb-3">🚑 AMBULANCE FLEET</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-orbitron">
                      <th className="text-left py-2 px-3">NAME</th>
                      <th className="text-left py-2 px-3">LOCATION</th>
                      <th className="text-left py-2 px-3">STATUS</th>
                      <th className="text-left py-2 px-3 hidden md:table-cell">DRIVER</th>
                      <th className="text-left py-2 px-3 hidden sm:table-cell">HANDLED</th>
                      <th className="text-left py-2 px-3 hidden sm:table-cell">REJECTED</th>
                      <th className="text-left py-2 px-3">ASSIGN DRIVER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ambulances.map(amb => {
                      const driver = profiles.find(p => p.id === amb.driver_id);
                      return (
                        <tr key={amb.id} className="border-b border-border/50">
                          <td className="py-2 px-3 font-mono-tech text-foreground">{amb.name}</td>
                          <td className="py-2 px-3 font-mono-tech text-foreground">
  {graph.nodes.find(n => n.id === amb.current_node)
    ? amb.current_node
    : graph.nodes[0]?.id}
</td>
                          <td className="py-2 px-3">
                            <span className={`font-orbitron font-bold ${amb.status === 'available' ? 'text-accent' : 'text-emergency-orange'}`}>
                              {amb.status?.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-foreground hidden md:table-cell">{driver?.full_name || '—'}</td>
                          <td className="py-2 px-3 font-mono-tech text-accent hidden sm:table-cell">{amb.cases_handled}</td>
                          <td className="py-2 px-3 font-mono-tech text-primary hidden sm:table-cell">{amb.cases_rejected}</td>
                          <td className="py-2 px-3">
                            <select
                              value={amb.driver_id || ''}
                              onChange={e => handleAssignDriver(amb.id, e.target.value)}
                              className="bg-secondary border border-border rounded px-2 py-1 text-foreground text-xs"
                            >
                              <option value="">Unassigned</option>
                              {driverProfiles.map(dp => (
                                <option key={dp.id} value={dp.id}>{dp.full_name || dp.id.slice(0, 8)}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'cases' && (
            <div className="panel-gradient border border-border rounded-lg p-4">
              <h3 className="font-orbitron text-sm text-foreground mb-3">📋 ALL CASES</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-orbitron">
                      <th className="text-left py-2 px-3">TIME</th>
                      <th className="text-left py-2 px-3">TYPE</th>
                      <th className="text-left py-2 px-3">PATIENT</th>
                      <th className="text-left py-2 px-3 hidden sm:table-cell">NODE</th>
                      <th className="text-left py-2 px-3">PRIORITY</th>
                      <th className="text-left py-2 px-3">STATUS</th>
                      <th className="text-left py-2 px-3">REPORT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emergencies.map(e => {
                      const pInfo = getPriorityInfo(e.case_type);
                      const statusColors: Record<string, string> = {
                        pending: 'text-emergency-yellow', assigned: 'text-emergency-orange',
                        accepted: 'text-emergency-blue', 'in-progress': 'text-emergency-orange',
                        resolved: 'text-accent', rejected: 'text-primary',
                      };
                      return (
                        <tr key={e.id} className="border-b border-border/50">
                          <td className="py-2 px-3 font-mono-tech text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                          <td className="py-2 px-3 text-foreground">{e.case_type}</td>
                          <td className="py-2 px-3 text-foreground">{e.patient_name}</td>
                          <td className="py-2 px-3 font-mono-tech text-foreground hidden sm:table-cell">{e.patient_node}</td>
                          <td className="py-2 px-3 font-mono-tech" style={{ color: pInfo.color }}>P{pInfo.priority}</td>
                          <td className={`py-2 px-3 font-orbitron font-bold uppercase ${statusColors[e.status] ?? 'text-foreground'}`}>
                            {e.status}
                          </td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => {
                                const reportData: CaseReportData = {
                                  caseId: e.id, patientName: e.patient_name, patientPhone: e.patient_phone,
                                  caseType: e.case_type, priority: e.priority, patientNode: e.patient_node,
                                  status: e.status, createdAt: e.created_at, updatedAt: e.updated_at,
                                  responseTimeMin: e.response_time_min, responseTimeMax: e.response_time_max,
                                };
                                downloadCaseReport(reportData);
                              }}
                              className="p-1.5 bg-secondary/50 hover:bg-secondary rounded transition-colors"
                              title="Download PDF Report"
                            >
                              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'drivers' && (
            <div className="panel-gradient border border-border rounded-lg p-4">
              <h3 className="font-orbitron text-sm text-foreground mb-3">👤 USER MANAGEMENT</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-orbitron">
                      <th className="text-left py-2 px-3">NAME</th>
                      <th className="text-left py-2 px-3">ROLE</th>
                      <th className="text-left py-2 px-3">CHANGE ROLE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map(p => {
                      const userRole = roles.find(r => r.user_id === p.id);
                      return (
                        <tr key={p.id} className="border-b border-border/50">
                          <td className="py-2 px-3 text-foreground">{p.full_name || p.id.slice(0, 8)}</td>
                          <td className="py-2 px-3 font-orbitron font-bold text-accent">{userRole?.role?.toUpperCase() ?? 'USER'}</td>
                          <td className="py-2 px-3">
                            <select
                              value={userRole?.role ?? 'user'}
                              onChange={e => handleChangeRole(p.id, e.target.value)}
                              className="bg-secondary border border-border rounded px-2 py-1 text-foreground text-xs"
                            >
                              <option value="user">User</option>
                              <option value="driver">Driver</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'analytics' && (
            <AnalyticsDashboard entries={analyticsData} />
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default AdminDashboard;
