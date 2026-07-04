'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseTimerResult {
  elapsedSeconds: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  formatted: string;
}

// MOM-036: tracks elapsed practice time for the session/attempt "time spent"
// reflection field (AnswerAttempt.timeSpentSeconds already exists — this hook
// feeds it from the UI). Ticks once per second while running.
export function useTimer(autoStart = false): UseTimerResult {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isRunning) return undefined;

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setElapsedSeconds(0);
    setIsRunning(false);
  }, []);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return { elapsedSeconds, isRunning, start, pause, reset, formatted };
}
