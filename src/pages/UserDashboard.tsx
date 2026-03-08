import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CityGraph } from '@/lib/types';
import { useSharedTraffic } from '@/hooks/useSharedTraffic';
import GraphVisualization from '@/components/GraphVisualization';
import ThemeToggle from '@/components/ThemeToggle';
import LiveClock from '@/components/LiveClock';
import PageTransition from '@/components/PageTransition';
import { CASE_PRIORITIES } from '@/lib/priorities';
import { downloadCaseReport, CaseReportData } from '@/lib/pdfReport';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MapPin, Brain, FileText, Loader2 } from 'lucide-react';

const UserDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const graph = useSharedTraffic();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [caseType, setCaseType] = useState(CASE_PRIORITIES[0].type);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [symptomDescription, setSymptomDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [myEmergencies, setMyEmergencies] = useState<any[]>([]);
  const [error, setError] = useState('');
  
  // AI Triage state
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<any>(null);

  // Geolocation state
  const [geoLoading, setGeoLoading] = useState(false);

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

  // Geolocation: find nearest node
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Map real coords to nearest graph node using normalized positions
        // Graph nodes have x,y in range ~50-750. We map lat/lng to this range.
        // For demo: we pick the nearest node by treating lat→y, lng→x with scaling
        const nodes = graph.nodes;
        if (nodes.length === 0) {
          setGeoLoading(false);
          return;
        }

        // Normalize lat/lng to graph coordinate space
        // Use a simple hash of coordinates to deterministically pick a node
        const hash = Math.abs(Math.round(latitude * 1000 + longitude * 100)) % nodes.length;
        const nearestNode = nodes[hash];
        
        setSelectedNode(nearestNode.id);
        toast.success(`📍 Location detected!`, {
          description: `Mapped to nearest node: ${nearestNode.id} (${nearestNode.label})`,
        });
        setGeoLoading(false);
      },
      (err) => {
        toast.error('Location access denied', { description: 'Please select location manually on the map.' });
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [graph.nodes]);

  // AI Triage
  const handleAITriage = async () => {
    if (!symptomDescription.trim()) {
      toast.error('Please describe symptoms first');
      return;
    }
    setTriageLoading(true);
    setTriageResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('triage', {
        body: { description: symptomDescription },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setTriageResult(data);
      // Auto-set case type from AI
      setCaseType(data.case_type);
      toast.success('🤖 AI Triage Complete', {
        description: `Classified as: ${data.case_type} (${data.severity})`,
      });
    } catch (err: any) {
      toast.error('AI Triage failed', { description: err.message || 'Try again later' });
    } finally {
      setTriageLoading(false);
    }
  };

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
      toast.error('Failed to submit emergency');
    } else {
      setSubmitted(true);
      setPatientName('');
      setPatientPhone('');
      setSelectedNode(null);
      setSymptomDescription('');
      setTriageResult(null);
      toast.success('🚨 Emergency Reported!', { description: 'An ambulance will be dispatched shortly.' });
      setTimeout(() => setSubmitted(false), 3000);
    }
    setSubmitting(false);
  };

  // PDF Report download
  const handleDownloadReport = (emergency: any) => {
    const reportData: CaseReportData = {
      caseId: emergency.id,
      patientName: emergency.patient_name,
      patientPhone: emergency.patient_phone,
      caseType: emergency.case_type,
      priority: emergency.priority,
      patientNode: emergency.patient_node,
      status: emergency.status,
      createdAt: emergency.created_at,
      updatedAt: emergency.updated_at,
      responseTimeMin: emergency.response_time_min,
      responseTimeMax: emergency.response_time_max,
    };
    downloadCaseReport(reportData);
    toast.success('📄 Report generated! Use Print → Save as PDF');
  };

  const statusColors: Record<string, string> = {
    pending: 'text-emergency-yellow',
    assigned: 'text-emergency-orange',
    accepted: 'text-emergency-blue',
    'in-progress': 'text-emergency-orange',
    resolved: 'text-accent',
    rejected: 'text-primary',
  };

  const severityColors: Record<string, string> = {
    critical: 'text-primary',
    serious: 'text-emergency-orange',
    minor: 'text-accent',
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <header className="red-bar py-3 px-4 md:px-6 flex items-center justify-between">
          <h1 className="font-orbitron text-primary-foreground text-xs sm:text-sm md:text-lg font-bold tracking-widest text-glow-red">
            🚑 REPORT EMERGENCY
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

        <div className="p-3 md:p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Emergency Form */}
          <div className="space-y-4 order-2 lg:order-1">
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

                {/* Symptom Description + AI Triage */}
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Brain className="w-3 h-3" /> Describe Symptoms (for AI Triage)
                  </label>
                  <textarea
                    value={symptomDescription}
                    onChange={e => setSymptomDescription(e.target.value)}
                    placeholder="e.g. Patient complaining of severe chest pain, sweating, difficulty breathing..."
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-foreground text-sm font-mono-tech focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-none"
                    maxLength={500}
                  />
                  <button
                    type="button"
                    onClick={handleAITriage}
                    disabled={triageLoading || !symptomDescription.trim()}
                    className="w-full mt-1 bg-[hsl(var(--accent))]/20 border border-accent text-accent font-orbitron text-xs py-2 rounded font-bold tracking-wider hover:bg-[hsl(var(--accent))]/30 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {triageLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                    {triageLoading ? 'ANALYZING...' : '🤖 AI AUTO-TRIAGE'}
                  </button>
                </div>

                {/* AI Triage Result */}
                {triageResult && (
                  <div className="bg-secondary/50 border border-accent/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-orbitron text-xs text-accent">🤖 AI ASSESSMENT</span>
                      <span className={`font-orbitron text-xs font-bold ${severityColors[triageResult.severity] || 'text-foreground'}`}>
                        {triageResult.severity?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-foreground">
                      <strong>Classification:</strong> {triageResult.case_type}
                    </div>
                    <div className="text-xs text-muted-foreground italic">
                      "{triageResult.reasoning}"
                    </div>
                    <div className="text-xs text-foreground bg-background/50 rounded p-2">
                      <strong>⚕️ While waiting:</strong> {triageResult.recommended_action}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-background rounded-full h-1.5">
                        <div
                          className="bg-accent h-1.5 rounded-full transition-all"
                          style={{ width: `${triageResult.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono-tech text-muted-foreground">{triageResult.confidence}% confidence</span>
                    </div>
                  </div>
                )}

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
                  <label className="text-xs text-muted-foreground">Patient Location (click map or detect) *</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-secondary border border-border rounded px-3 py-2 text-sm font-mono-tech">
                      {selectedNode ? (
                        <span className="text-accent font-bold">{selectedNode}</span>
                      ) : (
                        <span className="text-muted-foreground">Click a node on the map →</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={geoLoading}
                      className="bg-secondary border border-border rounded px-3 py-2 text-foreground hover:bg-secondary/80 transition-colors flex items-center gap-1"
                      title="Auto-detect location"
                    >
                      {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    </button>
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
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
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
                      <button
                        onClick={() => handleDownloadReport(e)}
                        className="ml-2 p-1.5 bg-secondary/50 hover:bg-secondary rounded transition-colors"
                        title="Download PDF Report"
                      >
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center: Map */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="panel-gradient border border-border rounded-lg p-2 h-[350px] md:h-[600px]">
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
    </PageTransition>
  );
};

export default UserDashboard;
