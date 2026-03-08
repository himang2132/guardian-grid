import React from 'react';

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-6 animate-pulse">
      {/* Header skeleton */}
      <div className="h-12 bg-muted rounded-lg mb-6" />
      
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
      
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-96 bg-muted rounded-lg" />
        <div className="lg:col-span-2 h-96 bg-muted rounded-lg" />
      </div>
    </div>
  );
};

export default LoadingSkeleton;
