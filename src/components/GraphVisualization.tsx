import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
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

const TRAFFIC_ROAD_COLORS: Record<TrafficLevel, string> = {
  low: 'hsl(145, 30%, 30%)',
  medium: 'hsl(45, 50%, 35%)',
  high: 'hsl(0, 50%, 35%)',
};

const NODE_COLORS: Record<string, string> = {
  junction: 'hsl(210, 60%, 50%)',
  hospital: 'hsl(0, 80%, 55%)',
  station: 'hsl(145, 60%, 45%)',
};

const SVG_W = 1050;
const SVG_H = 620;

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  graph, selectedStart, selectedEnd, pathResult, secondaryPath, onNodeClick, animatedEdges,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.min(4, Math.max(0.5, prev - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx / zoom, y: panStart.current.panY + dy / zoom });
  }, [isPanning, zoom]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

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

  // Generate pseudo-random buildings based on graph seed
  const buildings = useMemo(() => {
    const b: { x: number; y: number; w: number; h: number; opacity: number }[] = [];
    for (let i = 0; i < 80; i++) {
      const seed = (i * 7919 + 1013) % 10007;
      const x = (seed % SVG_W);
      const y = ((seed * 3) % SVG_H);
      const w = 12 + (seed % 25);
      const h = 12 + ((seed * 2) % 20);
      b.push({ x, y, w, h, opacity: 0.08 + (seed % 10) * 0.01 });
    }
    return b;
  }, []);

  const viewBox = `${SVG_W / 2 - SVG_W / (2 * zoom) - pan.x} ${SVG_H / 2 - SVG_H / (2 * zoom) - pan.y} ${SVG_W / zoom} ${SVG_H / zoom}`;

  return (
    <div className="relative w-full h-full">
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <button
          onClick={() => setZoom(z => Math.min(4, z * 1.3))}
          className="w-8 h-8 rounded bg-secondary/90 text-foreground font-bold text-lg hover:bg-secondary transition-colors flex items-center justify-center"
        >+</button>
        <button
          onClick={() => setZoom(z => Math.max(0.5, z / 1.3))}
          className="w-8 h-8 rounded bg-secondary/90 text-foreground font-bold text-lg hover:bg-secondary transition-colors flex items-center justify-center"
        >−</button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="w-8 h-8 rounded bg-secondary/90 text-muted-foreground text-xs hover:bg-secondary transition-colors flex items-center justify-center"
          title="Reset view"
        >⟲</button>
      </div>
      <div className="absolute bottom-2 left-2 z-10 text-xs font-mono-tech text-muted-foreground bg-card/80 px-2 py-1 rounded">
        Zoom: {Math.round(zoom * 100)}%
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="w-full h-full rounded-lg select-none"
        style={{ background: 'hsl(220, 35%, 6%)', cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern id="cityGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(215, 20%, 12%)" strokeWidth="0.3" />
          </pattern>
          <pattern id="fineGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="hsl(215, 15%, 10%)" strokeWidth="0.15" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="strongGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="shadowFilter">
            <feDropShadow dx="1" dy="1" stdDeviation="2" floodColor="black" floodOpacity="0.4" />
          </filter>
          {/* Road texture */}
          <linearGradient id="roadGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(220, 15%, 22%)" />
            <stop offset="50%" stopColor="hsl(220, 15%, 25%)" />
            <stop offset="100%" stopColor="hsl(220, 15%, 22%)" />
          </linearGradient>
        </defs>

        {/* Background layers */}
        <rect width={SVG_W} height={SVG_H} fill="hsl(220, 35%, 6%)" />
        <rect width={SVG_W} height={SVG_H} fill="url(#fineGrid)" />
        <rect width={SVG_W} height={SVG_H} fill="url(#cityGrid)" />

        {/* Buildings (background texture) */}
        {buildings.map((b, i) => (
          <rect key={`bld-${i}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="1"
            fill="hsl(220, 25%, 15%)" opacity={b.opacity} stroke="hsl(220, 20%, 18%)" strokeWidth="0.3" />
        ))}

        {/* Road surfaces (thick background lines) */}
        {graph.edges.map((edge, i) => {
          const from = graph.nodes.find(n => n.id === edge.from)!;
          const to = graph.nodes.find(n => n.id === edge.to)!;
          return (
            <line key={`road-bg-${i}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="hsl(220, 15%, 18%)" strokeWidth="12" strokeLinecap="round" opacity="0.6"
            />
          );
        })}

        {/* Road center lines and traffic coloring */}
        {graph.edges.map((edge, i) => {
          const from = graph.nodes.find(n => n.id === edge.from)!;
          const to = graph.nodes.find(n => n.id === edge.to)!;
          const key = `${edge.from}-${edge.to}`;
          const isOnPath = pathEdgeSet.has(key);
          const isOnSecondary = secondaryEdgeSet.has(key);
          const isAnimated = animatedEdges?.has(key);

          return (
            <g key={`edge-${i}`}>
              {/* Road surface */}
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={isOnPath ? 'hsl(145, 80%, 45%)' : isOnSecondary ? 'hsl(45, 90%, 50%)' : TRAFFIC_ROAD_COLORS[edge.trafficLevel]}
                strokeWidth={isOnPath ? 6 : isOnSecondary ? 5 : 3}
                strokeLinecap="round"
                opacity={isOnPath || isOnSecondary ? 0.9 : 0.5}
                filter={isOnPath ? 'url(#strongGlow)' : undefined}
              />
              {/* Center dashed line (road marking) */}
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={isOnPath ? 'hsl(145, 90%, 70%)' : isOnSecondary ? 'hsl(45, 100%, 70%)' : 'hsl(45, 30%, 40%)'}
                strokeWidth={isOnPath ? 1.5 : 0.5}
                strokeDasharray={isOnPath ? '8 6' : isAnimated ? '8 4' : '4 8'}
                strokeLinecap="round"
                opacity={isOnPath ? 1 : 0.4}
                className={isAnimated || isOnPath ? 'animate-dash-flow' : undefined}
              />
              {/* Traffic indicator dots */}
              {!isOnPath && !isOnSecondary && (
                <circle
                  cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r="3"
                  fill={TRAFFIC_COLORS[edge.trafficLevel]}
                  opacity="0.7"
                >
                  {edge.trafficLevel === 'high' && (
                    <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1.5s" repeatCount="indefinite" />
                  )}
                </circle>
              )}
              {/* Weight label */}
              {isOnPath && (
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 10}
                  fill="hsl(145, 80%, 70%)"
                  fontSize="10"
                  textAnchor="middle"
                  fontWeight="bold"
                  fontFamily="Share Tech Mono"
                  filter="url(#shadowFilter)"
                >
                  {getEffectiveWeight(edge)}s
                </text>
              )}
            </g>
          );
        })}

        {/* Intersection / Node rendering */}
        {graph.nodes.map((node) => {
          const isStart = node.id === selectedStart;
          const isEnd = node.id === selectedEnd;
          const isOnPath = pathResult?.path.includes(node.id);
          const isHospital = node.type === 'hospital';
          const isStation = node.type === 'station';
          const radius = isHospital ? 16 : isStation ? 14 : 8;

          return (
            <g key={node.id} onClick={(e) => { e.stopPropagation(); onNodeClick(node.id); }} className="cursor-pointer">
              {/* Outer glow for selected */}
              {(isStart || isEnd) && (
                <circle
                  cx={node.x} cy={node.y} r={radius + 8}
                  fill="none"
                  stroke={isStart ? 'hsl(210, 80%, 55%)' : 'hsl(0, 80%, 50%)'}
                  strokeWidth="2" opacity="0.6" filter="url(#glow)"
                >
                  <animate attributeName="r" values={`${radius + 5};${radius + 10};${radius + 5}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Building footprint for hospitals/stations */}
              {(isHospital || isStation) && (
                <rect
                  x={node.x - radius - 4} y={node.y - radius - 4}
                  width={(radius + 4) * 2} height={(radius + 4) * 2}
                  rx="3" fill="hsl(220, 28%, 14%)" stroke="hsl(215, 25%, 25%)" strokeWidth="1"
                  opacity="0.8"
                />
              )}

              {/* Node circle */}
              <circle
                cx={node.x} cy={node.y} r={radius}
                fill={isStart ? 'hsl(210, 80%, 55%)' : isEnd ? 'hsl(0, 80%, 50%)' : NODE_COLORS[node.type]}
                stroke={isOnPath ? 'hsl(145, 80%, 65%)' : 'hsl(215, 20%, 30%)'}
                strokeWidth={isOnPath ? 3 : 1.5}
                filter={isOnPath || isStart || isEnd ? 'url(#glow)' : undefined}
              />

              {/* Hospital cross */}
              {isHospital && (
                <>
                  <rect x={node.x - 6} y={node.y - 2} width="12" height="4" fill="white" rx="0.5" />
                  <rect x={node.x - 2} y={node.y - 6} width="4" height="12" fill="white" rx="0.5" />
                </>
              )}
              {/* Station icon */}
              {isStation && (
                <text x={node.x} y={node.y + 4} fill="white" fontSize="12" textAnchor="middle" fontWeight="bold">🚑</text>
              )}

              {/* Label */}
              <text
                x={node.x} y={node.y + radius + 14}
                fill="hsl(210, 20%, 70%)" fontSize="8" textAnchor="middle"
                fontFamily="Rajdhani" fontWeight="600"
              >
                {node.type === 'hospital' ? `🏥 ${node.id}` : node.type === 'station' ? `🚑 ${node.id}` : node.id}
              </text>
              {isStart && (
                <text x={node.x} y={node.y - radius - 8} fill="hsl(210, 80%, 70%)" fontSize="9" textAnchor="middle" fontFamily="Orbitron" fontWeight="bold">
                  AMBULANCE
                </text>
              )}
              {isEnd && (
                <text x={node.x} y={node.y - radius - 8} fill="hsl(0, 80%, 65%)" fontSize="9" textAnchor="middle" fontFamily="Orbitron" fontWeight="bold">
                  PATIENT
                </text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${SVG_W / 2 - SVG_W / (2 * zoom) - pan.x + 10}, ${SVG_H / 2 + SVG_H / (2 * zoom) - pan.y - 35})`}>
          <rect x="-5" y="-8" width="460" height="30" rx="4" fill="hsl(220, 30%, 10%)" opacity="0.9" stroke="hsl(215, 25%, 20%)" strokeWidth="0.5" />
          <circle cx="10" cy="6" r="4" fill="hsl(145, 60%, 45%)" />
          <text x="20" y="10" fill="hsl(145, 60%, 55%)" fontSize="9" fontFamily="Rajdhani">Optimal</text>
          <line x1="70" y1="6" x2="90" y2="6" stroke="hsl(45, 90%, 50%)" strokeWidth="2" />
          <text x="95" y="10" fill="hsl(45, 100%, 65%)" fontSize="9" fontFamily="Rajdhani">Alternate</text>
          <circle cx="155" cy="6" r="3" fill="hsl(145, 60%, 45%)" />
          <text x="163" y="10" fill="hsl(210, 20%, 60%)" fontSize="9" fontFamily="Rajdhani">Low Traffic</text>
          <circle cx="225" cy="6" r="3" fill="hsl(45, 100%, 55%)" />
          <text x="233" y="10" fill="hsl(210, 20%, 60%)" fontSize="9" fontFamily="Rajdhani">Medium</text>
          <circle cx="280" cy="6" r="3" fill="hsl(0, 80%, 50%)" />
          <text x="288" y="10" fill="hsl(210, 20%, 60%)" fontSize="9" fontFamily="Rajdhani">High</text>
          <circle cx="325" cy="6" r="6" fill="hsl(0, 80%, 55%)" />
          <rect x="321" y="4" width="8" height="3" fill="white" rx="0.5" />
          <rect x="323" y="1" width="3" height="8" fill="white" rx="0.5" />
          <text x="336" y="10" fill="hsl(210, 20%, 60%)" fontSize="9" fontFamily="Rajdhani">Hospital</text>
          <text x="385" y="10" fill="hsl(210, 20%, 60%)" fontSize="9" fontFamily="Rajdhani">🚑 Station</text>
        </g>
      </svg>
    </div>
  );
};

export default GraphVisualization;
