"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * A time in the viewer's own clock and locale. The server can't know either,
 * so it renders nothing and the browser fills it in, which avoids a hydration mismatch.
 */
export function LocalTime({ iso, short = false }: { iso: string; short?: boolean }) {
  const onClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const date = new Date(iso);
  return (
    <time dateTime={iso}>
      {onClient ? date.toLocaleTimeString([], short ? { hour: "2-digit", minute: "2-digit" } : undefined) : ""}
    </time>
  );
}
