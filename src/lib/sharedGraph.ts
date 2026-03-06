import { generateCityGraph } from './graphEngine';
import { CityGraph } from './types';

// Shared base graph used by all dashboards — deterministic seed ensures same layout everywhere
export const BASE_CITY_GRAPH: CityGraph = generateCityGraph(42);
