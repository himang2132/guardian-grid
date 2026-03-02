import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CityGraph } from '@/lib/types';
import { generateCityGraph, tickTraffic } from '@/lib/graphEngine';
import { dijkstra } from '@/lib/algorithms';
import GraphVisualization from '@/components/GraphVisualization';
import StatsBar from '@/components/StatsBar';
import { getPriorityInfo } from '@/lib/priorities';

const AdminDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const [graph, setGraph] = useState<CityGraph>(() => generateCityGraph());
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'ambulances' | 'cases' | 'drivers'>('overview');

  // Dynamic traffic
  useEffect(() => {
    const interval = setInterval(() => setGraph(prev => tickTraffic(prev, 0.12)), 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = useCallback(async () => {
    const [emRes, ambRes, assignRes, profRes, roleRes] = await Promise.all([
      supabase.from('emergencies').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('ambulances').select('*').order('name'),
      supabase.from('emergency_assignments').select('*, emergency:emergencies(*)').order('assigned_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
    ]);
    if (emRes.data) setEmergencies(emRes.data);
    if (ambRes.data) setAmbulances(ambRes.data);
    if (assignRes.data) setAssignments(assignRes.data as any[]);
    if (profRes.data) setProfiles(profRes.data);
    if (roleRes.data) setRoles(roleRes.data);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('admin-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergencies' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_assignments' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Auto-dispatch pending emergencies to nearest available ambulance
  const handleDispatch = async (emergencyId: string) => {
    const emergency = emergencies.find(e => e.id === emergencyId);
    if (!emergency) return;

    const available = ambulances.filter(a => a.status === 'available');
    if (available.length === 0) return;

    // Find nearest ambulance
    let bestAmb = available[0];
    let bestCost = Infinity;
    for (const amb of available) {
      const result = dijkstra(graph, amb.current_node, emergency.patient_node);
      if (result.totalCost < bestCost) {
        bestCost = result.totalCost;
        bestAmb = amb;
      }
    }

    await supabase.from('emergency_assignments').insert({
      emergency_id: emergencyId,
      ambulance_id: bestAmb.id,
      action: 'pending',
    });
    await supabase.from('emergencies').update({ status: 'assigned' }).eq('id', emergencyId);
    await supabase.from('ambulances').update({ status: 'en-route' }).eq('id', bestAmb.id);
  };

  // Assign driver to ambulance
  const handleAssignDriver = async (ambulanceId: string, driverId: string) => {
    await supabase.from('ambulances').update({ driver_id: driverId }).eq('id', ambulanceId);
    fetchAll();
  };

  // Change user role
  const handleChangeRole = async (userId: string, newRole: string) => {
    // Delete old role and insert new
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('user_roles').insert({ user_id: userId, role: newRole as any });
    fetchAll();
  };

  const totalEmergencies = emergencies.length;
  const activeAmbulances = ambulances.filter(a => a.status !== 'available').length;
  const resolvedCases = emergencies.filter(e => e.status === 'resolved').length;
  const avgResponseTime = 0; // Would calculate from actual data

  const pendingEmergencies = emergencies.filter(e => e.status === 'pending');
  const drivers = roles.filter(r => r.role === 'driver');
  const driverProfiles = profiles.filter(p => drivers.some(d => d.user_id === p.id));

  return (
    <div className="min-h-screen bg-background">
      <header className="red-bar py-3 px-6 flex items-center justify-between">
        <h1 className="font-orbitron text-primary-foreground text-sm md:text-lg font-bold tracking-widest text-glow-red">
          🛡️ ADMIN CONTROL CENTER
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-primary-foreground/80 text-xs font-mono-tech">{user?.email}</span>
          <button onClick={signOut} className="bg-secondary/30 text-primary-foreground font-orbitron text-xs px-3 py-1 rounded hover:bg-secondary/50">
            LOGOUT
          </button>
        </div>
      </header>

      <div className="px-6 py-3">
        <StatsBar
          totalEmergencies={totalEmergencies}
          activeAmbulances={activeAmbulances}
          avgResponseTime={avgResponseTime}
          resolvedCases={resolvedCases}
        />
      </div>

      {/* Tabs */}
      <div className="px-6 flex gap-2 mb-4">
        {(['overview', 'ambulances', 'cases', 'drivers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`font-orbitron text-xs px-4 py-2 rounded font-bold transition-colors ${
              tab === t ? 'red-bar text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="px-6 pb-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pending emergencies */}
            <div className="panel-gradient border border-border rounded-lg p-4">
              <h3 className="font-orbitron text-sm text-foreground mb-3">
                🚨 PENDING DISPATCH ({pendingEmergencies.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {pendingEmergencies.map(e => {
                  const pInfo = getPriorityInfo(e.case_type);
                  return (
                    <div key={e.id} className="bg-secondary/30 rounded p-3 border border-border">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-orbitron text-xs font-bold text-foreground">{e.case_type}</span>
                          <p className="text-xs text-muted-foreground mt-1">
                            {e.patient_name} • Node: {e.patient_node}
                          </p>
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

            {/* Map */}
            <div className="lg:col-span-2 panel-gradient border border-border rounded-lg p-2 h-[500px]">
              <GraphVisualization
                graph={graph}
                selectedStart={null}
                selectedEnd={null}
                pathResult={null}
                secondaryPath={null}
                onNodeClick={() => {}}
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
                    <th className="text-left py-2 px-3">DRIVER</th>
                    <th className="text-left py-2 px-3">HANDLED</th>
                    <th className="text-left py-2 px-3">REJECTED</th>
                    <th className="text-left py-2 px-3">ASSIGN DRIVER</th>
                  </tr>
                </thead>
                <tbody>
                  {ambulances.map(amb => {
                    const driver = profiles.find(p => p.id === amb.driver_id);
                    return (
                      <tr key={amb.id} className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono-tech text-foreground">{amb.name}</td>
                        <td className="py-2 px-3 font-mono-tech text-foreground">{amb.current_node}</td>
                        <td className="py-2 px-3">
                          <span className={`font-orbitron font-bold ${amb.status === 'available' ? 'text-accent' : 'text-emergency-orange'}`}>
                            {amb.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-foreground">{driver?.full_name || '—'}</td>
                        <td className="py-2 px-3 font-mono-tech text-accent">{amb.cases_handled}</td>
                        <td className="py-2 px-3 font-mono-tech text-primary">{amb.cases_rejected}</td>
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
                    <th className="text-left py-2 px-3">NODE</th>
                    <th className="text-left py-2 px-3">PRIORITY</th>
                    <th className="text-left py-2 px-3">STATUS</th>
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
                        <td className="py-2 px-3 font-mono-tech text-foreground">{e.patient_node}</td>
                        <td className="py-2 px-3 font-mono-tech" style={{ color: pInfo.color }}>P{pInfo.priority}</td>
                        <td className={`py-2 px-3 font-orbitron font-bold uppercase ${statusColors[e.status] ?? 'text-foreground'}`}>
                          {e.status}
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
      </div>
    </div>
  );
};

export default AdminDashboard;
