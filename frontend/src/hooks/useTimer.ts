import { useState, useEffect, useRef, useCallback } from 'react';

interface TimerHook {
  seconds: number;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  isTooLong: boolean;   // > 120s
  isWarning: boolean;   // > 60s
}

export function useTimer(): TimerHook {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const start = useCallback(() => {
    setSeconds(0);
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => { setSeconds(0); setIsRunning(false); }, []);

  return {
    seconds,
    isRunning,
    start,
    stop,
    reset,
    isWarning: seconds > 60,   // 1분 경과 시 주의 (권장 답변 시간)
    isTooLong: seconds > 120,  // 2분 초과 시 경고
  };
}

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
