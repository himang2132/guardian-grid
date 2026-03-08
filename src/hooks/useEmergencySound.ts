import { useCallback, useRef } from 'react';

/**
 * Plays an emergency alert sound using Web Audio API (no external files needed).
 */
export function useEmergencySound() {
  const contextRef = useRef<AudioContext | null>(null);

  const playAlert = useCallback(() => {
    try {
      if (!contextRef.current) {
        contextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = contextRef.current;

      // Two-tone siren: hi-lo pattern
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      // 3 cycles of hi-lo
      for (let i = 0; i < 3; i++) {
        playTone(880, now + i * 0.4, 0.18);
        playTone(660, now + i * 0.4 + 0.2, 0.18);
      }
    } catch {
      // Audio not supported — fail silently
    }
  }, []);

  return { playAlert };
}
