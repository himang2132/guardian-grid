import React from 'react';
import { Ambulance } from '@/lib/types';

interface AmbulanceListProps {
  ambulances: Ambulance[];
}

const STATE_STYLES: Record<Ambulance['state'], { bg: string; text: string; label: string }> = {
  available: { bg: 'bg-emergency-green/20', text: 'text-emergency-green', label: 'AVAILABLE' },
  assigned: { bg: 'bg-emergency-yellow/20', text: 'text-emergency-yellow', label: 'ASSIGNED' },
  'en-route': { bg: 'bg-emergency-orange/20', text: 'text-emergency-orange', label: 'EN ROUTE' },
  completed: { bg: 'bg-emergency-blue/20', text: 'text-emergency-blue', label: 'COMPLETED' },
};

const AmbulanceList: React.FC<AmbulanceListProps> = ({ ambulances }) => {
  return (
    <div className="panel-gradient border border-border rounded-lg p-4">
      <h3 className="font-orbitron text-sm text-foreground mb-3">🚑 AMBULANCE FLEET</h3>
      <div className="space-y-2">
        {ambulances.map((amb) => {
          const style = STATE_STYLES[amb.state];
          return (
            <div key={amb.id} className="flex items-center justify-between bg-secondary/30 rounded p-2">
              <div>
                <span className="font-mono-tech text-foreground text-sm">{amb.name}</span>
                <span className="text-muted-foreground text-xs ml-2">@ {amb.currentNode}</span>
              </div>
              <span className={`${style.bg} ${style.text} px-2 py-0.5 rounded text-xs font-orbitron font-bold`}>
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AmbulanceList;
