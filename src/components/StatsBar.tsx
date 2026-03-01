import React from 'react';

interface StatsBarProps {
  totalEmergencies: number;
  activeAmbulances: number;
  avgResponseTime: number;
  resolvedCases: number;
}

const StatsBar: React.FC<StatsBarProps> = ({ totalEmergencies, activeAmbulances, avgResponseTime, resolvedCases }) => {
  const stats = [
    { label: 'Total Emergencies', value: totalEmergencies, icon: '🚨' },
    { label: 'Active Ambulances', value: activeAmbulances, icon: '🚑' },
    { label: 'Avg Response (s)', value: avgResponseTime, icon: '⏱️' },
    { label: 'Cases Resolved', value: resolvedCases, icon: '✅' },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="panel-gradient border border-border rounded-lg p-3 text-center">
          <div className="text-xl mb-1">{s.icon}</div>
          <div className="font-mono-tech text-xl text-foreground font-bold">{s.value}</div>
          <div className="text-muted-foreground text-xs font-rajdhani">{s.label}</div>
        </div>
      ))}
    </div>
  );
};

export default StatsBar;
