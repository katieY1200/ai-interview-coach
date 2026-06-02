import { useState, useEffect } from 'react';

interface Warning {
  label: string;
  type: string;
}

interface Props {
  warning: Warning | null;
}

export function BehaviorWarningBanner({ warning }: Props) {
  // warning prop이 null이 돼도 배너가 사라지기 전까지 마지막 내용을 유지해야 해서
  // 별도 상태로 복사해둔다
  const [shown, setShown] = useState<Warning | null>(null);

  useEffect(() => {
    if (!warning) return;
    setShown(warning);
    const t = setTimeout(() => setShown(null), 3500);
    return () => clearTimeout(t);
  }, [warning]);

  if (!shown) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce-once">
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-2.5">
        <span className="text-amber-500 text-lg">⚠️</span>
        <span className="text-amber-800 font-medium text-sm">{shown.label}</span>
      </div>
    </div>
  );
}
