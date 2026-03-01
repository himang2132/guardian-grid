import React, { useMemo } from 'react';
import { CityGraph, PathResult, TrafficLevel } from '@/lib/types';
import { getEffectiveWeight } from '@/lib/graphEngine';

interface GraphVisualizationProps {
  graph: CityGraph;
  selectedStart: string | null;
  selectedEnd: string | null;
  pathResult: PathResult | null;
  secondaryPath: PathResult | null;
  onNodeClick: (nodeId: string) => void;
  animatedEdges?: Set<string>;
}

const TRAFFIC_COLORS: Record<TrafficLevel, string> = {
  low: 'hsl(145, 60%, 45%)',
  medium: 'hsl(45, 100%, 55%)',
  high: 'hsl(0, 80%, 50%)',
};

const NODE_COLORS: Record<string, string> = {
  junction: 'hsl(210, 80%, 55%)',
  hospital: 'hsl(0, 80%, 50%)',
  station: 'hsl(145, 60%, 45%)',
};

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  graph, selectedStart, selectedEnd, pathResult, secondaryPath, onNodeClick, animatedEdges,
}) => {
  const pathEdgeSet = useMemo(() => {
    const set = new Set<string>();
    if (pathResult?.path) {
      for (let i = 0; i < pathResult.path.length - 1; i++) {
        set.add(`${pathResult.path[i]}-${pathResult.path[i + 1]}`);
        set.add(`${pathResult.path[i + 1]}-${pathResult.path[i]}`);
      }
    }
    return set;
  }, [pathResult]);

  const secondaryEdgeSet = useMemo(() => {
    const set = new Set<string>();
    if (secondaryPath?.path) {
      for (let i = 0; i < secondaryPath.path.length - 1; i++) {
        set.add(`${secondaryPath.path[i]}-${secondaryPath.path[i + 1]}`);
        set.add(`${secondaryPath.path[i + 1]}-${secondaryPath.path[i]}`);
      }
    }
    return set;
  }, [secondaryPath]);

  const svgWidth = 1050;
  const svgHeight = 620;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full h-full rounded-lg"
      style={{ background: 'hsl(220, 35%, 8%)' }}
    >
      {/* Grid pattern */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(215, 25%, 15%)" strokeWidth="0.5" />
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="strongGlow">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={svgWidth} height={svgHeight} fill="url(#grid)" />

      {/* Edges */}
      {graph.edges.map((edge, i) => {
        const from = graph.nodes.find(n => n.id === edge.from)!;
        const to = graph.nodes.find(n => n.id === edge.to)!;
        const key = `${edge.from}-${edge.to}`;
        const isOnPath = pathEdgeSet.has(key);
        const isOnSecondary = secondaryEdgeSet.has(key);
        const isAnimated = animatedEdges?.has(key);

        return (
          <g key={`edge-${i}`}>
            {/* Base edge */}
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={isOnPath ? 'hsl(145, 80%, 55%)' : isOnSecondary ? 'hsl(45, 100%, 55%)' : TRAFFIC_COLORS[edge.trafficLevel]}
              strokeWidth={isOnPath ? 4 : isOnSecondary ? 3 : 1.5}
              opacity={isOnPath || isOnSecondary ? 1 : 0.4}
              filter={isOnPath ? 'url(#strongGlow)' : undefined}
              strokeDasharray={isAnimated ? '8 4' : undefined}
              className={isAnimated ? 'animate-dash-flow' : undefined}
            />
            {/* Weight label */}
            {!isOnPath && (
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 5}
                fill="hsl(215, 15%, 45%)"
                fontSize="9"
                textAnchor="middle"
                fontFamily="Share Tech Mono"
              >
                {getEffectiveWeight(edge)}s
              </text>
            )}
            {isOnPath && (
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 8}
                fill="hsl(145, 80%, 70%)"
                fontSize="11"
                textAnchor="middle"
                fontWeight="bold"
                fontFamily="Share Tech Mono"
              >
                {getEffectiveWeight(edge)}s
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {graph.nodes.map((node) => {
        const isStart = node.id === selectedStart;
        const isEnd = node.id === selectedEnd;
        const isOnPath = pathResult?.path.includes(node.id);
        const radius = node.type === 'junction' ? 10 : 14;

        return (
          <g
            key={node.id}
            onClick={() => onNodeClick(node.id)}
            className="cursor-pointer"
          >
            {/* Selection ring */}
            {(isStart || isEnd) && (
              <circle
                cx={node.x} cy={node.y} r={radius + 6}
                fill="none"
                stroke={isStart ? 'hsl(210, 80%, 55%)' : 'hsl(0, 80%, 50%)'}
                strokeWidth="2"
                opacity="0.8"
                filter="url(#glow)"
              >
                <animate attributeName="r" values={`${radius + 4};${radius + 8};${radius + 4}`} dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Node circle */}
            <circle
              cx={node.x} cy={node.y} r={radius}
              fill={isStart ? 'hsl(210, 80%, 55%)' : isEnd ? 'hsl(0, 80%, 50%)' : NODE_COLORS[node.type]}
              stroke={isOnPath ? 'hsl(145, 80%, 65%)' : 'hsl(215, 25%, 25%)'}
              strokeWidth={isOnPath ? 3 : 1.5}
              filter={isOnPath ? 'url(#glow)' : undefined}
            />
            {/* Hospital cross */}
            {node.type === 'hospital' && (
              <>
                <rect x={node.x - 5} y={node.y - 2} width="10" height="4" fill="white" rx="0.5" />
                <rect x={node.x - 2} y={node.y - 5} width="4" height="10" fill="white" rx="0.5" />
              </>
            )}
            {/* Station icon */}
            {node.type === 'station' && (
              <text x={node.x} y={node.y + 4} fill="white" fontSize="12" textAnchor="middle" fontWeight="bold">🚑</text>
            )}
            {/* Label */}
            <text
              x={node.x}
              y={node.y + radius + 14}
              fill="hsl(210, 20%, 75%)"
              fontSize="9"
              textAnchor="middle"
              fontFamily="Rajdhani"
              fontWeight="600"
            >
              {node.id}
            </text>
            {isStart && (
              <text x={node.x} y={node.y - radius - 6} fill="hsl(210, 80%, 70%)" fontSize="10" textAnchor="middle" fontFamily="Orbitron" fontWeight="bold">
                AMBULANCE
              </text>
            )}
            {isEnd && (
              <text x={node.x} y={node.y - radius - 6} fill="hsl(0, 80%, 65%)" fontSize="10" textAnchor="middle" fontFamily="Orbitron" fontWeight="bold">
                PATIENT
              </text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(20, ${svgHeight - 45})`}>
        <rect x="-10" y="-12" width="500" height="40" rx="6" fill="hsl(220, 28%, 14%)" opacity="0.9" stroke="hsl(215, 25%, 22%)" />
        <text x="5" y="8" fill="hsl(210, 20%, 70%)" fontSize="12" fontFamily="Rajdhani" fontWeight="600">Legend:</text>
        <circle cx="80" cy="4" r="5" fill="hsl(145, 60%, 45%)" />
        <text x="90" y="8" fill="hsl(145, 60%, 55%)" fontSize="11" fontFamily="Rajdhani">Optimal Route</text>
        <line x1="175" y1="4" x2="195" y2="4" stroke="hsl(0, 80%, 50%)" strokeWidth="3" />
        <text x="200" y="8" fill="hsl(0, 80%, 60%)" fontSize="11" fontFamily="Rajdhani">Heavy Traffic</text>
        <line x1="290" y1="4" x2="310" y2="4" stroke="hsl(45, 100%, 55%)" strokeWidth="3" />
        <text x="315" y="8" fill="hsl(45, 100%, 65%)" fontSize="11" fontFamily="Rajdhani">Alternate Route</text>
        <circle cx="410" cy="4" r="5" fill="hsl(0, 80%, 50%)" />
        <rect x="405" y="-1" width="10" height="3" fill="white" rx="0.5" />
        <rect x="408" y="-4" width="3" height="10" fill="white" rx="0.5" />
        <text x="422" y="8" fill="hsl(210, 20%, 70%)" fontSize="11" fontFamily="Rajdhani">Hospital</text>
      </g>
    </svg>
  );
};

export default GraphVisualization;
