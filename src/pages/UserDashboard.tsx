import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CityGraph } from '@/lib/types';
import { useSharedTraffic } from '@/hooks/useSharedTraffic';
import GraphVisualization from '@/components/GraphVisualization';
import { CASE_PRIORITIES } from '@/lib/priorities';
import { useNavigate } from 'react-router-dom';

const UserDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const graph = useSharedTraffic();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [caseType, setCaseType] = useState(CASE_PRIORITIES[0].type);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [myEmergencies, setMyEmergencies] = useState<any[]>([]);
  const [error, setError] = useState('');

  // Fetch user's emergencies
  useEffect(() => {
    if (!user) return;
    const fetchEmergencies = async () => {
      const { data } = await supabase
        .from('emergencies')
        .select('*')
        .eq('reported_by', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setMyEmergencies(data);
    };
    fetchEmergencies();

    // Realtime subscription
    const channel = supabase
      .channel('user-emergencies')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'emergencies',
        filter: `reported_by=eq.${user.id}`,
      }, () => fetchEmergencies())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
  }, []);

  const handleSubmitEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) { setError('Please select patient location on the map'); return; }
    if (!patientName.trim()) { setError('Patient name is required'); return; }
    setError('');
    setSubmitting(true);

    const priority = CASE_PRIORITIES.find(p => p.type === caseType);
    const { error: err } = await supabase.from('emergencies').insert({
      reported_by: user!.id,
      patient_name: patientName.trim(),
      patient_phone: patientPhone.trim() || null,
      patient_node: selectedNode,
      case_type: caseType,
      priority: priority?.priority ?? 5,
      response_time_min: priority?.responseTimeMin ?? 10,
      response_time_max: priority?.responseTimeMax ?? 15,
      status: 'pending',
    });

    if (err) {
      setError(err.message);
    } else {
      setSubmitted(true);
      setPatientName('');
      setPatientPhone('');
      setSelectedNode(null);
      setTimeout(() => setSubmitted(false), 3000);
    }
    setSubmitting(false);
  };

  const statusColors: Record<string, string> = {
    pending: 'text-emergency-yellow',
    assigned: 'text-emergency-orange',
    accepted: 'text-emergency-blue',
    'in-progress': 'text-emergency-orange',
    resolved: 'text-accent',
    rejected: 'text-primary',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="red-bar py-3 px-6 flex items-center justify-between">
        <h1 className="font-orbitron text-primary-foreground text-sm md:text-lg font-bold tracking-widest text-glow-red">
          🚑 REPORT EMERGENCY
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-primary-foreground/80 text-xs font-mono-tech">{user?.email}</span>
          <button onClick={signOut} className="bg-secondary/30 text-primary-foreground font-orbitron text-xs px-3 py-1 rounded hover:bg-secondary/50">
            LOGOUT
          </button>
        </div>
      </header>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Emergency Form */}
        <div className="space-y-4">
          <div className="panel-gradient border border-border rounded-lg p-4">
            <h3 className="font-orbitron text-sm text-foreground mb-3">📍 REPORT NEW CASE</h3>
            <form onSubmit={handleSubmitEmergency} className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Patient Name *</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-foreground text-sm font-mono-tech focus:outline-none focus:ring-1 focus:ring-primary"
                  maxLength={100}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone Number</label>
                <input
                  type="tel"
                  value={patientPhone}
                  onChange={e => setPatientPhone(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-foreground text-sm font-mono-tech focus:outline-none focus:ring-1 focus:ring-primary"
                  maxLength={15}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Case Type *</label>
                <select
                  value={caseType}
                  onChange={e => setCaseType(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-foreground text-sm font-mono-tech focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {CASE_PRIORITIES.map(p => (
                    <option key={p.type} value={p.type}>
                      {p.type} ({p.responseTimeMin}-{p.responseTimeMax} min)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Patient Location (click on map) *</label>
                <div className="bg-secondary border border-border rounded px-3 py-2 text-sm font-mono-tech">
                  {selectedNode ? (
                    <span className="text-accent font-bold">{selectedNode}</span>
                  ) : (
                    <span className="text-muted-foreground">Click a node on the map →</span>
                  )}
                </div>
              </div>

              {error && <p className="text-primary text-xs">{error}</p>}
              {submitted && <p className="text-accent text-xs font-bold">✅ Emergency reported! Ambulance will be dispatched.</p>}

              <button
                type="submit"
                disabled={submitting || !selectedNode}
                className="w-full red-bar text-primary-foreground font-orbitron text-xs py-2.5 rounded font-bold tracking-wider hover:opacity-90 disabled:opacity-50 animate-pulse-emergency"
              >
                {submitting ? 'SUBMITTING...' : '🚨 SEND EMERGENCY ALERT'}
              </button>
            </form>
          </div>

          <div className="panel-gradient border border-border rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-xs">Or call directly:</p>
            <p className="text-primary font-orbitron text-3xl font-bold text-glow-red mt-1">108</p>
          </div>

          {/* My cases */}
          <div className="panel-gradient border border-border rounded-lg p-4">
            <h3 className="font-orbitron text-sm text-foreground mb-3">📋 MY CASES</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {myEmergencies.length === 0 && <p className="text-muted-foreground text-xs">No cases reported yet</p>}
              {myEmergencies.map(e => (
                <div key={e.id} className="bg-secondary/30 rounded p-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-mono-tech text-foreground">{e.case_type}</span>
                    <span className={`font-orbitron font-bold uppercase ${statusColors[e.status] ?? 'text-foreground'}`}>
                      {e.status}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {e.patient_name} • Node {e.patient_node} • {new Date(e.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Map */}
        <div className="lg:col-span-2">
          <div className="panel-gradient border border-border rounded-lg p-2 h-[600px]">
            <div className="text-xs text-muted-foreground mb-1 px-2 font-rajdhani">
              👆 Click a node to set patient location
              {selectedNode && <span className="text-accent ml-2">Selected: <b>{selectedNode}</b></span>}
            </div>
            <GraphVisualization
              graph={graph}
              selectedStart={null}
              selectedEnd={selectedNode}
              pathResult={null}
              secondaryPath={null}
              onNodeClick={handleNodeClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
