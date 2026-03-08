import React, { useState, useEffect } from 'react';

const LiveClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="font-mono-tech text-xs text-muted-foreground">
      {time.toLocaleTimeString()} • {time.toLocaleDateString()}
    </span>
  );
};

export default LiveClock;
