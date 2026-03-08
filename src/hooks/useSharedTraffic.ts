import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CityGraph, TrafficLevel } from '@/lib/types';
import { BASE_CITY_GRAPH } from '@/lib/sharedGraph';
import { tickTraffic } from '@/lib/graphEngine';

type TrafficData = Record<number, TrafficLevel>; // edge index -> level

const CHANNEL_NAME = 'shared-traffic';
const TICK_INTERVAL = 3000;

/**
 * Shared traffic hook — uses Supabase Realtime broadcast so all pages
 * see the exact same traffic state. One tab becomes the "leader" and
 * broadcasts traffic ticks; all others listen and apply.
 */
export function useSharedTraffic() {
  const [graph, setGraph] = useState<CityGraph>(() => ({
    ...BASE_CITY_GRAPH,
    edges: BASE_CITY_GRAPH.edges.map(e => ({ ...e })),
  }));

  const isLeader = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Apply a traffic snapshot (map of edge-index → trafficLevel)
  const applyTraffic = useCallback((data: TrafficData) => {
    setGraph(prev => ({
      ...prev,
      edges: prev.edges.map((e, i) => (data[i] !== undefined ? { ...e, trafficLevel: data[i] } : e)),
    }));
  }, []);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: true } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'traffic_tick' }, (payload: any) => {
        if (payload.payload?.traffic) {
          applyTraffic(payload.payload.traffic as TrafficData);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        // First joiner becomes leader
        const state = channel.presenceState();
        const allIds = Object.values(state).flat().map((p: any) => p.id);
        if (allIds.length > 0) {
          isLeader.current = allIds[0] === myId;
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: myId });
        }
      });

    const myId = crypto.randomUUID();

    // Tick interval — only the leader broadcasts
    const interval = setInterval(() => {
      // Always generate locally first, then broadcast if leader
      setGraph(prev => {
        const next = tickTraffic(prev, 0.12);
        // Build compact traffic map
        const traffic: TrafficData = {};
        next.edges.forEach((e, i) => {
          traffic[i] = e.trafficLevel;
        });

        // Broadcast (even non-leaders try; presence determines real leader,
        // but using self:true + broadcast means everyone stays synced)
        if (isLeader.current) {
          channel.send({
            type: 'broadcast',
            event: 'traffic_tick',
            payload: { traffic },
          });
        }

        return next;
      });
    }, TICK_INTERVAL);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [applyTraffic]);

  return graph;
}
