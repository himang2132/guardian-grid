export interface CasePriority {
  type: string;
  priority: number; // 1 = highest
  responseTimeMin: number; // minutes
  responseTimeMax: number; // minutes
  color: string;
}

export const CASE_PRIORITIES: CasePriority[] = [
  { type: 'Cardiac Arrest', priority: 1, responseTimeMin: 4, responseTimeMax: 6, color: 'hsl(0, 80%, 50%)' },
  { type: 'Severe Heart Attack', priority: 2, responseTimeMin: 8, responseTimeMax: 10, color: 'hsl(0, 70%, 55%)' },
  { type: 'Severe Accident / Heavy Bleeding', priority: 3, responseTimeMin: 5, responseTimeMax: 10, color: 'hsl(25, 95%, 55%)' },
  { type: 'Stroke', priority: 4, responseTimeMin: 10, responseTimeMax: 15, color: 'hsl(45, 100%, 55%)' },
  { type: 'Asthma Attack', priority: 5, responseTimeMin: 8, responseTimeMax: 12, color: 'hsl(45, 80%, 50%)' },
  { type: 'Burns', priority: 5, responseTimeMin: 10, responseTimeMax: 15, color: 'hsl(30, 90%, 50%)' },
  { type: 'Breathing Difficulty', priority: 5, responseTimeMin: 8, responseTimeMax: 12, color: 'hsl(200, 70%, 50%)' },
  { type: 'Fracture', priority: 6, responseTimeMin: 20, responseTimeMax: 30, color: 'hsl(210, 60%, 50%)' },
];

export function getPriorityInfo(caseType: string): CasePriority {
  return CASE_PRIORITIES.find(p => p.type === caseType) ?? CASE_PRIORITIES[CASE_PRIORITIES.length - 1];
}
