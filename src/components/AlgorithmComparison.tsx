import React from 'react';
import { PathResult } from '@/lib/types';

interface AlgorithmComparisonProps {
  dijkstra: PathResult | null;
  greedy: PathResult | null;
}

const AlgorithmComparison: React.FC<AlgorithmComparisonProps> = ({ dijkstra, greedy }) => {
  if (!dijkstra && !greedy) {
    return (
      <div className="panel-gradient border border-border rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2">ALGORITHM COMPARISON</h3>
        <p className="text-muted-foreground text-sm">Select start & end nodes to compare algorithms</p>
      </div>
    );
  }

  const rows = [
    { label: 'Total Cost (s)', d: dijkstra?.totalCost ?? '-', g: greedy?.totalCost ?? '-' },
    { label: 'Distance (km)', d: dijkstra?.totalDistance ?? '-', g: greedy?.totalDistance ?? '-' },
    { label: 'Nodes Visited', d: dijkstra?.nodesVisited ?? '-', g: greedy?.nodesVisited ?? '-' },
    { label: 'Exec Time (ms)', d: dijkstra?.executionTime ?? '-', g: greedy?.executionTime ?? '-' },
    { label: 'Path Length', d: dijkstra?.path.length ?? '-', g: greedy?.path.length ?? '-' },
  ];

  const winner = dijkstra && greedy
    ? dijkstra.totalCost <= greedy.totalCost ? 'dijkstra' : 'greedy'
    : null;

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
                <span className="text-emergency-yellow">Greedy BFS</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border/50">
                <td className="py-2 text-muted-foreground">{row.label}</td>
                <td className="py-2 text-center font-mono-tech text-emergency-green">{row.d}</td>
                <td className="py-2 text-center font-mono-tech text-emergency-yellow">{row.g}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {winner && (
        <div className={`mt-3 text-center py-2 rounded font-orbitron text-xs ${winner === 'dijkstra' ? 'bg-emergency-green/20 text-emergency-green' : 'bg-emergency-yellow/20 text-emergency-yellow'}`}>
          ✓ {winner === 'dijkstra' ? 'DIJKSTRA' : 'GREEDY BFS'} WINS — OPTIMAL PATH
        </div>
      )}
    </div>
  );
};

export default AlgorithmComparison;
