import React from 'react';
import { PathResult } from '@/lib/types';

interface AlgorithmComparisonProps {
  dijkstra: PathResult | null;
  greedy: PathResult | null;
  astar?: PathResult | null;
}

const AlgorithmComparison: React.FC<AlgorithmComparisonProps> = ({ dijkstra, greedy, astar }) => {
  if (!dijkstra && !greedy && !astar) {
    return (
      <div className="panel-gradient border border-border rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2">ALGORITHM COMPARISON</h3>
        <p className="text-muted-foreground text-sm">Select start & end nodes to compare algorithms</p>
      </div>
    );
  }

  const rows = [
    { label: 'Total Cost (s)', d: dijkstra?.totalCost ?? '-', g: greedy?.totalCost ?? '-', a: astar?.totalCost ?? '-' },
    { label: 'Distance (km)', d: dijkstra?.totalDistance ?? '-', g: greedy?.totalDistance ?? '-', a: astar?.totalDistance ?? '-' },
    { label: 'Nodes Visited', d: dijkstra?.nodesVisited ?? '-', g: greedy?.nodesVisited ?? '-', a: astar?.nodesVisited ?? '-' },
    { label: 'Exec Time (ms)', d: dijkstra?.executionTime ?? '-', g: greedy?.executionTime ?? '-', a: astar?.executionTime ?? '-' },
    { label: 'Path Length', d: dijkstra?.path.length ?? '-', g: greedy?.path.length ?? '-', a: astar?.path.length ?? '-' },
  ];

  const costs = [
    { algo: 'dijkstra' as const, cost: dijkstra?.totalCost ?? Infinity },
    { algo: 'greedy' as const, cost: greedy?.totalCost ?? Infinity },
    { algo: 'astar' as const, cost: astar?.totalCost ?? Infinity },
  ];
  const winner = costs.reduce((a, b) => a.cost <= b.cost ? a : b).algo;
  const winnerLabel = winner === 'dijkstra' ? 'DIJKSTRA' : winner === 'greedy' ? 'GREEDY BFS' : 'A*';
  const winnerColor = winner === 'dijkstra' ? 'bg-emergency-green/20 text-emergency-green' : winner === 'astar' ? 'bg-emergency-blue/20 text-emergency-blue' : 'bg-emergency-yellow/20 text-emergency-yellow';

  return (
    <div className="panel-gradient border border-border rounded-lg p-4">
      <h3 className="font-orbitron text-sm text-foreground mb-3">ALGORITHM COMPARISON</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-muted-foreground font-rajdhani">Metric</th>
              <th className="text-center py-2 font-rajdhani">
                <span className="text-emergency-green">Dijkstra</span>
              </th>
              <th className="text-center py-2 font-rajdhani">
                <span className="text-emergency-yellow">Greedy</span>
              </th>
              <th className="text-center py-2 font-rajdhani">
                <span className="text-emergency-blue">A*</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border/50">
                <td className="py-2 text-muted-foreground">{row.label}</td>
                <td className="py-2 text-center font-mono-tech text-emergency-green">{row.d}</td>
                <td className="py-2 text-center font-mono-tech text-emergency-yellow">{row.g}</td>
                <td className="py-2 text-center font-mono-tech text-emergency-blue">{row.a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`mt-3 text-center py-2 rounded font-orbitron text-xs ${winnerColor}`}>
        ✓ {winnerLabel} WINS — OPTIMAL PATH
      </div>
    </div>
  );
};

export default AlgorithmComparison;
