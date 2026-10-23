"use client";

import { useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { createLongPress, type LongPressPoint } from "@/lib/long-press";

/**
 * Tap-and-hold on list items (touch, pen and mouse). A scroll fires
 * pointercancel or moves past the tolerance, so it never triggers by
 * accident. `bind(key)` gives the pointer handlers for one item.
 */
export function useLongPress<K>(onLongPress: (key: K, p: LongPressPoint) => void, delay?: number) {
  const cbRef = useRef(onLongPress);
  cbRef.current = onLongPress;
  const keyRef = useRef<K | null>(null);
  const ctl = useMemo(
    () =>
      createLongPress({
        delay,
        onLongPress: (p) => {
          if (keyRef.current != null) cbRef.current(keyRef.current, p);
        },
      }),
    [delay],
  );
  useEffect(() => () => ctl.cancel(), [ctl]);

  const bind = useCallback(
    (key: K) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        keyRef.current = key;
        ctl.down(e.clientX, e.clientY, e.pointerType, e.button);
      },
      onPointerMove: (e: ReactPointerEvent) => ctl.move(e.clientX, e.clientY),
      onPointerUp: () => ctl.up(),
      onPointerCancel: () => ctl.cancel(),
      onPointerLeave: () => ctl.cancel(),
    }),
    [ctl],
  );

  return { bind, consumeClick: ctl.consumeClick, cancel: ctl.cancel };
}
