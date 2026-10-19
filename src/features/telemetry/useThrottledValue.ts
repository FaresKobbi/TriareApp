import { useEffect, useRef, useState } from "react";

/**
 * Returns `value`, but changes at most once every `ms`; the last value is
 * never lost (it is delivered when the wait ends). Used so that numbers fed at
 * 20 Hz are readable and do not repaint the whole panel for nothing.
 */
export function useThrottledValue<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  const lastChange = useRef(0);

  useEffect(() => {
    const wait = ms - (Date.now() - lastChange.current);
    if (wait <= 0) {
      lastChange.current = Date.now();
      setShown(value);
      return;
    }
    const timer = setTimeout(() => {
      lastChange.current = Date.now();
      setShown(value);
    }, wait);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return shown;
}
