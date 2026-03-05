import React, { useMemo } from 'react';
import { AnalyticsEntry } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';

interface AnalyticsDashboardProps {
  entries: AnalyticsEntry[];
}

const ALGO_COLORS = {
  dijkstra: 'hsl(145, 60%, 45%)',
  greedy: 'hsl(45, 100%, 55%)',
  astar: 'hsl(210, 80%, 55%)',
};

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ entries }) => {
  // Algorithm win rates
  const winRates = useMemo(() => {
    const counts = { dijkstra: 0, greedy: 0, astar: 0 };
    entries.forEach(e => counts[e.winner]++);
    const total = entries.length || 1;
    return [
      { name: 'Dijkstra', value: counts.dijkstra, pct: Math.round(counts.dijkstra / total * 100) },
      { name: 'Greedy BFS', value: counts.greedy, pct: Math.round(counts.greedy / total * 100) },
      { name: 'A*', value: counts.astar, pct: Math.round(counts.astar / total * 100) },
    ];
  }, [entries]);

  // Response time history
  const responseHistory = useMemo(() => {
    return entries.slice(-20).map((e, i) => ({
      idx: i + 1,
      dijkstra: Math.round(e.dijkstraCost),
      greedy: Math.round(e.greedyCost),
      astar: Math.round(e.astarCost),
      caseType: e.caseType,
    }));
  }, [entries]);

  // On-time rate
  const onTimeRate = useMemo(() => {
    if (entries.length === 0) return 0;
    return Math.round(entries.filter(e => e.onTime).length / entries.length * 100);
  }, [entries]);

  // Avg response times
  const avgTimes = useMemo(() => {
    if (entries.length === 0) return { dijkstra: 0, greedy: 0, astar: 0 };
    const sum = entries.reduce((acc, e) => ({
      dijkstra: acc.dijkstra + e.dijkstraCost,
      greedy: acc.greedy + e.greedyCost,
      astar: acc.astar + e.astarCost,
    }), { dijkstra: 0, greedy: 0, astar: 0 });
    const n = entries.length;
    return {
      dijkstra: Math.round(sum.dijkstra / n),
      greedy: Math.round(sum.greedy / n),
      astar: Math.round(sum.astar / n),
    };
  }, [entries]);

  const PIE_COLORS = [ALGO_COLORS.dijkstra, ALGO_COLORS.greedy, ALGO_COLORS.astar];

  if (entries.length === 0) {
    return (
      <div className="panel-gradient border border-border rounded-lg p-6 text-center">
        <h3 className="font-orbitron text-sm text-foreground mb-2">📊 ANALYTICS</h3>
        <p className="text-muted-foreground text-sm">No data yet. Accept emergencies to generate analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="panel-gradient border border-border rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground font-orbitron">TOTAL CASES</p>
          <p className="text-2xl font-mono-tech text-foreground font-bold">{entries.length}</p>
        </div>
        <div className="panel-gradient border border-border rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground font-orbitron">ON-TIME %</p>
          <p className={`text-2xl font-mono-tech font-bold ${onTimeRate >= 80 ? 'text-accent' : onTimeRate >= 50 ? 'text-emergency-yellow' : 'text-primary'}`}>{onTimeRate}%</p>
        </div>
        <div className="panel-gradient border border-border rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground font-orbitron">AVG RESPONSE</p>
          <p className="text-2xl font-mono-tech text-emergency-blue font-bold">{Math.floor(avgTimes.dijkstra / 60)}m {avgTimes.dijkstra % 60}s</p>
        </div>
        <div className="panel-gradient border border-border rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground font-orbitron">BEST ALGO</p>
          <p className="text-2xl font-mono-tech text-accent font-bold">{winRates.sort((a, b) => b.value - a.value)[0]?.name}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Algorithm Win Rates Pie Chart */}
        <div className="panel-gradient border border-border rounded-lg p-4">
          <h3 className="font-orbitron text-sm text-foreground mb-3">🏆 ALGORITHM WIN RATES</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={winRates} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, pct }) => `${name}: ${pct}%`}>
                {winRates.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(220, 28%, 14%)', border: '1px solid hsl(215, 25%, 22%)', color: 'hsl(210, 20%, 90%)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Response Time Bar Chart */}
        <div className="panel-gradient border border-border rounded-lg p-4">
          <h3 className="font-orbitron text-sm text-foreground mb-3">⏱️ AVG COST BY ALGORITHM</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { name: 'Dijkstra', cost: avgTimes.dijkstra },
              { name: 'Greedy', cost: avgTimes.greedy },
              { name: 'A*', cost: avgTimes.astar },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 25%, 22%)" />
              <XAxis dataKey="name" stroke="hsl(215, 15%, 55%)" fontSize={11} />
              <YAxis stroke="hsl(215, 15%, 55%)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(220, 28%, 14%)', border: '1px solid hsl(215, 25%, 22%)', color: 'hsl(210, 20%, 90%)' }} />
              <Bar dataKey="cost" fill="hsl(210, 80%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Response Time Trend Line Chart */}
      <div className="panel-gradient border border-border rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-foreground mb-3">📈 RESPONSE TIME TREND (Last 20)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={responseHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 25%, 22%)" />
            <XAxis dataKey="idx" stroke="hsl(215, 15%, 55%)" fontSize={11} label={{ value: 'Case #', position: 'insideBottom', offset: -5, fill: 'hsl(215, 15%, 55%)' }} />
            <YAxis stroke="hsl(215, 15%, 55%)" fontSize={11} label={{ value: 'Cost (s)', angle: -90, position: 'insideLeft', fill: 'hsl(215, 15%, 55%)' }} />
            <Tooltip contentStyle={{ background: 'hsl(220, 28%, 14%)', border: '1px solid hsl(215, 25%, 22%)', color: 'hsl(210, 20%, 90%)' }} />
            <Legend />
            <Line type="monotone" dataKey="dijkstra" stroke={ALGO_COLORS.dijkstra} strokeWidth={2} dot={{ r: 3 }} name="Dijkstra" />
            <Line type="monotone" dataKey="greedy" stroke={ALGO_COLORS.greedy} strokeWidth={2} dot={{ r: 3 }} name="Greedy" />
            <Line type="monotone" dataKey="astar" stroke={ALGO_COLORS.astar} strokeWidth={2} dot={{ r: 3 }} name="A*" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
