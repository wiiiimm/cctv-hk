import { useEffect, useRef, type RefObject } from "react";
import { markUnavailable } from "../lib/snapshots";

// YouTube IFrame API error codes that mean the video will not play here:
// 2 invalid id, 5 HTML5 player error, 100 not found / removed / private, 101 & 150 embedding not allowed.
const UNAVAILABLE = new Set([2, 5, 100, 101, 150]);

// Player states (IFrame API): -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued.
const PLAYING = 1;
const NOT_STARTED = new Set([-1, 2, 5]);

/**
 * Talk to an embedded YouTube player (embed URL must include enablejsapi=1):
 * - mark the channel unavailable when the player reports "Video unavailable";
 * - make it play. Players are always loaded muted (browsers block autoplay with sound, which left a switched-to
 *   pinned video black); once ready we send play, and unmute when this tile should have sound (`sound`). If the
 *   browser pauses it for unmuting without a user gesture, it goes back to muted playback and sound is retried on
 *   the next click / key press. Sound on / off is a message, not a new URL, so it never reloads the player.
 */
export function useYouTubeErrors(ref: RefObject<HTMLIFrameElement | null>, channelKey: string, enabled = true, sound = false) {
  const soundRef = useRef(sound);
  const send = useRef<(func: string, args?: unknown[]) => void>(() => {});

  useEffect(() => {
    const frame = ref.current;
    if (!enabled || !frame) return;
    const post = (msg: object) => frame.contentWindow?.postMessage(JSON.stringify(msg), "*");
    // Commands only once the player says it's ready (earlier ones hit its not-yet-loaded API and throw inside it).
    let ready = false;
    const command = (func: string, args: unknown[] = []) => {
      if (ready) post({ event: "command", func, args });
    };
    send.current = command;
    const hello = () => post({ event: "listening", id: channelKey });

    let state: number | undefined;
    let nudges = 0;
    let unmutedAt = 0;
    let soundBlocked = false;
    const applySound = () => {
      if (soundRef.current && !soundBlocked) {
        command("unMute");
        command("setVolume", [100]);
        unmutedAt = Date.now();
      } else command("mute");
    };
    const kick = () => {
      command("playVideo");
      applySound();
    };
    // Keep nudging a player that hasn't started (or got paused) — but only a few times.
    const nudge = setInterval(() => {
      if (!ready || state === PLAYING || state === 3 || nudges >= 6) return;
      nudges++;
      if (soundBlocked) command("mute");
      command("playVideo");
    }, 1500);
    // A user gesture lets the browser allow sound again.
    const regain = () => {
      if (!soundBlocked) return;
      soundBlocked = false;
      applySound();
      command("playVideo");
    };
    window.addEventListener("pointerdown", regain);
    window.addEventListener("keydown", regain);

    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
      let data: { event?: string; info?: unknown };
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data?.event === "onError" && UNAVAILABLE.has(Number(data.info))) markUnavailable(channelKey);
      if (data?.event === "onReady") {
        ready = true;
        kick();
      }
      const info = data?.info as { playerState?: number } | undefined;
      const next = data?.event === "onStateChange" ? Number(data.info) : info && typeof info.playerState === "number" ? info.playerState : undefined;
      if (next === undefined) return;
      // Paused right after we unmuted: the browser refused sound without a gesture. Play muted instead.
      if (next === 2 && soundRef.current && Date.now() - unmutedAt < 2500) {
        soundBlocked = true;
        command("mute");
        command("playVideo");
      }
      if (next === PLAYING) nudges = 0;
      state = next;
      if (NOT_STARTED.has(next) && nudges === 0) {
        nudges = 1;
        command("playVideo");
      }
    };
    window.addEventListener("message", onMessage);
    // A new src (channel change) reloads the player: wait for its onReady again.
    const reload = () => {
      ready = false;
      state = undefined;
      nudges = 0;
      hello();
    };
    frame.addEventListener("load", reload);
    hello();
    return () => {
      clearInterval(nudge);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("pointerdown", regain);
      window.removeEventListener("keydown", regain);
      frame.removeEventListener("load", reload);
      send.current = () => {};
    };
  }, [ref, channelKey, enabled]);

  // Sound on / off (pin, unpin, mute toggle) without reloading the player.
  useEffect(() => {
    soundRef.current = sound;
    if (sound) {
      send.current("unMute");
      send.current("setVolume", [100]);
    } else send.current("mute");
  }, [sound]);
}
