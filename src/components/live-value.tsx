"use client";

import * as React from "react";

/**
 * Animated peso figure for the landing hero: counts up on mount, then nudges
 * upward every few seconds so it reads like live sales landing in real time.
 * Pure client-side, respects prefers-reduced-motion.
 */
export function LiveValue({ target }: { target: number }) {
  const [display, setDisplay] = React.useState(target);

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target);
      return;
    }

    const targetRef = { current: Math.round(target) };
    let current = Math.round(target * 0.991); // start a touch below for the count-up
    let raf = 0;

    const tick = () => {
      const diff = targetRef.current - current;
      if (Math.abs(diff) > 0.5) {
        current += diff * 0.09; // ease toward the target
        setDisplay(Math.round(current));
        raf = requestAnimationFrame(tick);
      } else {
        current = targetRef.current;
        setDisplay(current);
      }
    };
    raf = requestAnimationFrame(tick);

    const id = window.setInterval(() => {
      targetRef.current += Math.floor(60 + Math.random() * 360); // +₱60–420 "sales"
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }, 2800);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [target]);

  return (
    <>
      ₱{display.toLocaleString("en-US")}
      <span className="text-[#94A3B8]">.00</span>
    </>
  );
}
