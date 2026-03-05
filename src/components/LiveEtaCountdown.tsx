import React, { useState, useEffect, useRef } from 'react';

interface LiveEtaCountdownProps {
  totalCostSeconds: number;
  label?: string;
  onExpired?: () => void;
}

const LiveEtaCountdown: React.FC<LiveEtaCountdownProps> = ({ totalCostSeconds, label = 'ETA', onExpired }) => {
  const [remaining, setRemaining] = useState(totalCostSeconds);
  const startTimeRef = useRef(Date.now());
  const initialCostRef = useRef(totalCostSeconds);

  // Reset when totalCostSeconds changes significantly (reroute)
  useEffect(() => {
    startTimeRef.current = Date.now();
    initialCostRef.current = totalCostSeconds;
    setRemaining(totalCostSeconds);
  }, [totalCostSeconds]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const r = Math.max(0, initialCostRef.current - elapsed);
      setRemaining(r);
      if (r <= 0) {
        onExpired?.();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [onExpired]);

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  const tenths = Math.floor((remaining % 1) * 10);
  const isUrgent = remaining < 60;
  const isExpired = remaining <= 0;

  return (
    <div className={`panel-gradient border rounded-lg p-3 text-center ${isExpired ? 'border-primary glow-red' : isUrgent ? 'border-emergency-orange' : 'border-accent glow-green'}`}>
      <p className="font-orbitron text-xs text-muted-foreground mb-1">{label}</p>
      <div className={`font-mono-tech text-2xl font-bold tracking-wider ${isExpired ? 'text-primary animate-pulse-emergency' : isUrgent ? 'text-emergency-orange' : 'text-accent'}`}>
        {isExpired ? 'ARRIVED' : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`}
      </div>
      {!isExpired && (
        <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${isUrgent ? 'bg-emergency-orange' : 'bg-accent'}`}
            style={{ width: `${Math.max(0, (1 - remaining / initialCostRef.current) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default LiveEtaCountdown;
