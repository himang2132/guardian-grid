import React from 'react';
import { motion } from 'framer-motion';

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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
          className="panel-gradient border border-border rounded-lg p-3 text-center"
        >
          <div className="text-xl mb-1">{s.icon}</div>
          <div className="font-mono-tech text-xl text-foreground font-bold">{s.value}</div>
          <div className="text-muted-foreground text-xs font-rajdhani">{s.label}</div>
        </motion.div>
      ))}
    </div>
  );
};

export default StatsBar;
