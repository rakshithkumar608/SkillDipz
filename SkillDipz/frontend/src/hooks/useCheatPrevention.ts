"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UseCheatPreventionOptions {
  maxViolations?: number;
  onMaxViolations?: () => void;
  enabled?: boolean;
}

interface UseCheatPreventionReturn {
  tabSwitchCount: number;
  isWarning: boolean;
  isMaxed: boolean;
}


export function useCheatPrevention({
  maxViolations = 3,
  onMaxViolations,
  enabled = true,
}: UseCheatPreventionOptions = {}): UseCheatPreventionReturn {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const countRef = useRef(0);
  const calledMaxRef = useRef(false);

  const handleVisibilityChange = useCallback(() => {
    if (!enabled) return;
    if (document.hidden) {
      countRef.current += 1;
      setTabSwitchCount(countRef.current);

      const remaining = maxViolations - countRef.current;

      if (countRef.current >= maxViolations) {
        if (!calledMaxRef.current) {
          calledMaxRef.current = true;
          toast.error(
            `🚨 Max violations reached! Auto-submitting...`,
            { duration: 3000 }
          );
          setTimeout(() => {
            onMaxViolations?.();
          }, 1500);
        }
      } else {
        toast.warning(
          `⚠️ Tab switch detected! (${countRef.current}/${maxViolations}) — ${remaining} warning${remaining === 1 ? "" : "s"} left`,
          { duration: 4000 }
        );
      }
    }
  }, [enabled, maxViolations, onMaxViolations]);

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, handleVisibilityChange]);

  return {
    tabSwitchCount,
    isWarning: tabSwitchCount > 0,
    isMaxed: tabSwitchCount >= maxViolations,
  };
}
