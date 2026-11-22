import { useEffect, useState } from "react";

// Starting many YouTube players in the same instant gets them refused as a burst (they come up "unavailable"):
// preview players take turns, one start every START_GAP ms. A lone new player (a patrol swap, a retune) starts at once.
const START_GAP = 450;
let nextStart = 0;
function takeSlot(): number {
  const now = Date.now();
  const at = Math.max(now, nextStart);
  nextStart = at + START_GAP;
  return at - now;
}

/** True once this player may start. `wait` false (pinned / selected video) = immediately. Re-queues when `id` changes. */
export function usePlayerSlot(want: boolean, wait: boolean, id: string): boolean {
  const [ready, setReady] = useState(!wait);
  useEffect(() => {
    if (!want || !wait) {
      setReady(true);
      return;
    }
    setReady(false);
    const tm = setTimeout(() => setReady(true), takeSlot());
    return () => clearTimeout(tm);
  }, [want, wait, id]);
  return want && ready;
}
