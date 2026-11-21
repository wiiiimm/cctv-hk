import { useEffect } from "react";
import { actions, store } from "../lib/store";
import { PRESET_IDS } from "../lib/crt/presets";

function cyclePreset(dir: number) {
  const i = PRESET_IDS.indexOf(store.get().crtPreset);
  actions.setPreset(PRESET_IDS[(i + dir + PRESET_IDS.length) % PRESET_IDS.length]);
}
export { cyclePreset };

/** Keyboard, gamepad and patrol timer: everything that drives the store without a pointer. */
export function useControls() {
  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = store.get();
      const single = s.focused || s.cells.length === 1;
      let handled = true;
      if (/^[0-9]$/.test(e.key)) {
        actions.typeDigit(e.key);
      } else
        switch (e.key) {
          case "Enter":
          case " ":
            if (actions.commitEntry()) {
              /* tuned */
            } else if (s.focused) actions.unfocus();
            else actions.escalate();
            break;
          case "Escape":
            if (s.entry) actions.clearEntry();
            else actions.deescalate();
            break;
          case "Backspace":
            actions.clearEntry();
            break;
          case "ArrowUp":
            single ? actions.channelStep(1) : actions.moveSelection(0, -1);
            break;
          case "ArrowDown":
            single ? actions.channelStep(-1) : actions.moveSelection(0, 1);
            break;
          case "ArrowLeft":
            single ? actions.channelStep(-1) : actions.moveSelection(-1, 0);
            break;
          case "ArrowRight":
            single ? actions.channelStep(1) : actions.moveSelection(1, 0);
            break;
          case "PageUp":
          case "+":
          case "=":
            actions.channelStep(1);
            break;
          case "PageDown":
          case "-":
          case "_":
            actions.channelStep(-1);
            break;
          case "]":
            actions.pageStep(1);
            break;
          case "[":
            actions.pageStep(-1);
            break;
          case "l":
          case "L":
            actions.resizePreviews(e.shiftKey ? -1 : 1);
            break;
          case "p":
          case "P":
            actions.togglePatrol();
            break;
          case "c":
          case "C":
            actions.toggleMode();
            break;
          case "v":
          case "V":
            cyclePreset(e.shiftKey ? -1 : 1);
            break;
          case "t":
          case "T":
            actions.toggleTheater();
            break;
          case "g":
          case "G":
            actions.toggleMap();
            break;
          case "m":
          case "M":
            actions.toggleMute();
            break;
          case "*":
            actions.toggleFavourite(s.cells[s.selected]);
            break;
          case "f":
          case "F":
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen?.();
            break;
          default:
            handled = false;
        }
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Patrol: re-arm whenever it is toggled or the dwell time changes.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const arm = () => {
      clearInterval(timer);
      const s = store.get();
      if (s.patrol) timer = setInterval(() => actions.pageStep(1), s.patrolSec * 1000);
    };
    let last = `${store.get().patrol}:${store.get().patrolSec}`;
    arm();
    const unsub = store.subscribe(() => {
      const s = store.get();
      const sig = `${s.patrol}:${s.patrolSec}`;
      if (sig !== last) {
        last = sig;
        arm();
      }
    });
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  // Gamepad: standard mapping, edge-triggered.
  useEffect(() => {
    let raf = 0;
    let prev: boolean[] = [];
    const loop = () => {
      const pad = navigator.getGamepads?.().find((p) => p && p.mapping === "standard");
      if (pad) {
        const now = pad.buttons.map((b) => b.pressed);
        const hit = (i: number) => now[i] && !prev[i];
        const s = store.get();
        const single = s.focused || s.cells.length === 1;
        if (hit(12)) single ? actions.channelStep(1) : actions.moveSelection(0, -1);
        if (hit(13)) single ? actions.channelStep(-1) : actions.moveSelection(0, 1);
        if (hit(14)) single ? actions.channelStep(-1) : actions.moveSelection(-1, 0);
        if (hit(15)) single ? actions.channelStep(1) : actions.moveSelection(1, 0);
        if (hit(0)) (s.focused ? actions.unfocus() : actions.escalate());
        if (hit(1)) actions.deescalate();
        if (hit(2)) actions.resizePreviews(1);
        if (hit(3)) actions.toggleMap();
        if (hit(4)) actions.channelStep(-1);
        if (hit(5)) actions.channelStep(1);
        if (hit(6)) actions.pageStep(-1);
        if (hit(7)) actions.pageStep(1);
        if (hit(8)) actions.toggleMode();
        if (hit(9)) actions.togglePatrol();
        prev = now;
      }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("gamepadconnected", start);
    return () => {
      window.removeEventListener("gamepadconnected", start);
      cancelAnimationFrame(raf);
    };
  }, []);
}
