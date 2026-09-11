import { useEffect, useState } from "react";
import { LogoMark } from "./icons";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fade out after 1.5 seconds
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1500);

    // Complete after 2 seconds
    const completeTimer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink-950 transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Center content - Logo and title */}
      <div className="flex flex-col items-center gap-6">
        {/* Logo with subtle pulse animation */}
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-full bg-ember-500/20 blur-xl" />
          <LogoMark className="relative h-24 w-24 drop-shadow-[0_4px_16px_rgba(245,168,60,0.3)]" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide">
            <span className="text-ember-400">C++</span>
            <span className="text-mist-100"> Compiler</span>
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="rounded border border-pulse-500/50 px-2 py-0.5 font-display text-xs font-semibold tracking-[0.2em] text-pulse-400">
              LITE
            </span>
          </div>
        </div>

        {/* Subtle loading indicator */}
        <div className="mt-8 flex items-center gap-1">
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-ember-400" style={{ animationDelay: "0ms" }} />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-ember-400" style={{ animationDelay: "150ms" }} />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-ember-400" style={{ animationDelay: "300ms" }} />
        </div>
      </div>

      {/* Bottom content - NeuraSaMu Build */}
      <div className="absolute bottom-12 left-0 right-0 text-center">
        <p className="font-display text-sm font-medium tracking-wider text-mist-500">
          NeuraSaMu Build
        </p>
        <p className="mt-1 font-mono text-[10px] text-mist-600">
          v1.0.0
        </p>
      </div>
    </div>
  );
}
