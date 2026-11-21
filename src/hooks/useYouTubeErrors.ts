import { useEffect, type RefObject } from "react";
import { markUnavailable } from "../lib/snapshots";

// YouTube IFrame API error codes that mean the video will not play here:
// 2 invalid id, 5 HTML5 player error, 100 not found / removed / private, 101 & 150 embedding not allowed.
const UNAVAILABLE = new Set([2, 5, 100, 101, 150]);

/**
 * Listen to an embedded YouTube player (embed URL must include enablejsapi=1) and mark the channel off air
 * when the player reports "Video unavailable".
 */
export function useYouTubeErrors(ref: RefObject<HTMLIFrameElement | null>, channelKey: string, enabled = true) {
  useEffect(() => {
    const frame = ref.current;
    if (!enabled || !frame) return;
    const hello = () => frame.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: channelKey }), "*");
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
      let data: { event?: string; info?: unknown };
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data?.event === "onError" && UNAVAILABLE.has(Number(data.info))) markUnavailable(channelKey);
    };
    window.addEventListener("message", onMessage);
    frame.addEventListener("load", hello);
    hello();
    return () => {
      window.removeEventListener("message", onMessage);
      frame.removeEventListener("load", hello);
    };
  }, [ref, channelKey, enabled]);
}
