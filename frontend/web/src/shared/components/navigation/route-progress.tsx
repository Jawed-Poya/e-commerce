import { useEffect, useRef, useState } from "react";
import { useNavigation } from "react-router-dom";

const CompletionDelayMs = 180;
const TickMs = 140;

export function RouteProgress() {
  const navigation = useNavigation();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const completionTimer = useRef<number | null>(null);

  useEffect(() => {
    if (navigation.state === "idle") {
      if (!visible) return;

      setProgress(100);
      completionTimer.current = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, CompletionDelayMs);
      return;
    }

    if (completionTimer.current !== null) {
      window.clearTimeout(completionTimer.current);
      completionTimer.current = null;
    }

    setVisible(true);
    setProgress((current) => Math.max(current, 10));

    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current;
        return Math.min(92, current + Math.max(1.5, (92 - current) * 0.12));
      });
    }, TickMs);

    return () => window.clearInterval(interval);
  }, [navigation.state, visible]);

  useEffect(
    () => () => {
      if (completionTimer.current !== null) {
        window.clearTimeout(completionTimer.current);
      }
    },
    [],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[250] h-0.5 overflow-hidden"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full w-full origin-left bg-primary text-primary shadow-[0_0_10px_currentColor] transition-transform duration-150 ease-out rtl:origin-right"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}
