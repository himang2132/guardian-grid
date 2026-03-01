import React from 'react';
import { TrafficLevel } from '@/lib/types';

interface TrafficControlsProps {
  currentLevel: TrafficLevel;
  onSetLevel: (level: TrafficLevel) => void;
  onRandomize: () => void;
}

const TrafficControls: React.FC<TrafficControlsProps> = ({ currentLevel, onSetLevel, onRandomize }) => {
  const levels: { value: TrafficLevel; label: string; color: string }[] = [
    { value: 'low', label: 'LOW', color: 'bg-emergency-green' },
    { value: 'medium', label: 'MEDIUM', color: 'bg-emergency-yellow' },
    { value: 'high', label: 'HIGH', color: 'bg-primary' },
  ];

  return (
    <div className="panel-gradient border border-border rounded-lg p-4">
      <h3 className="font-orbitron text-sm text-foreground mb-3">🚦 TRAFFIC SIMULATION</h3>
      <div className="space-y-2">
        <div className="flex gap-2">
          {levels.map(l => (
            <button
              key={l.value}
              onClick={() => onSetLevel(l.value)}
              className={`flex-1 py-1.5 rounded text-xs font-orbitron font-bold transition-all ${
                currentLevel === l.value
                  ? `${l.color} text-primary-foreground`
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={onRandomize}
          className="w-full py-1.5 rounded text-xs font-orbitron font-bold bg-emergency-blue/20 text-emergency-blue hover:bg-emergency-blue/30 transition-colors"
        >
          RANDOMIZE TRAFFIC
        </button>
      </div>
    </div>
  );
};

export default TrafficControls;
