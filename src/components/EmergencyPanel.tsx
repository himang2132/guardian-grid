import React from 'react';
import { Emergency } from '@/lib/types';

interface EmergencyPanelProps {
  emergency: Emergency | null;
  onAccept: () => void;
  onReject: () => void;
}

const EmergencyPanel: React.FC<EmergencyPanelProps> = ({ emergency, onAccept, onReject }) => {
  if (!emergency) return null;

  return (
    <div className="panel-gradient border border-primary rounded-lg overflow-hidden glow-red">
      {/* Red header bar */}
      <div className="red-bar py-2 px-4 text-center">
        <h2 className="font-orbitron text-primary-foreground text-lg font-bold tracking-wider">
          🚨 EMERGENCY REQUEST RECEIVED!
        </h2>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-secondary/50 rounded p-2">
            <span className="text-muted-foreground text-xs">Patient Location</span>
            <p className="font-mono-tech text-foreground font-bold">{emergency.patientNode}</p>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <span className="text-muted-foreground text-xs">Emergency Type</span>
            <p className="font-mono-tech text-primary font-bold">{emergency.emergencyType}</p>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <span className="text-muted-foreground text-xs">Patient</span>
            <p className="font-mono-tech text-foreground font-bold">{emergency.patientName} ({emergency.age})</p>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <span className="text-muted-foreground text-xs">Status</span>
            <p className={`font-mono-tech font-bold ${emergency.status === 'pending' ? 'text-emergency-yellow' : emergency.status === 'in-progress' ? 'text-emergency-orange' : 'text-emergency-green'}`}>
              {emergency.status.toUpperCase()}
            </p>
          </div>
        </div>

        {emergency.status === 'pending' && (
          <div className="flex gap-2 pt-2">
            <button onClick={onAccept} className="flex-1 bg-emergency-green hover:bg-emergency-green/80 text-primary-foreground font-orbitron text-sm py-2.5 rounded font-bold tracking-wider transition-colors">
              ACCEPT EMERGENCY
            </button>
            <button onClick={onReject} className="flex-1 bg-primary hover:bg-primary/80 text-primary-foreground font-orbitron text-sm py-2.5 rounded font-bold tracking-wider transition-colors">
              REJECT EMERGENCY
            </button>
          </div>
        )}

        {emergency.status === 'resolved' && (
          <div className="bg-emergency-green/10 border border-emergency-green/30 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">✅</div>
            <h4 className="font-orbitron text-emergency-green font-bold">CASE RESOLVED</h4>
            <p className="text-muted-foreground text-sm mt-1">Patient safely transported to hospital</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmergencyPanel;
