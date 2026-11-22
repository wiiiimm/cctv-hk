import { useEffect } from "react";
import { actions, lastSequenceTick, store } from "../lib/store";
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Text boxes keep every key (arrows move the caret there).
      if (t.closest("textarea, [contenteditable=''], [contenteditable='true'], input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button])")) return;
      // Arrow keys always pick the channel — never the focused control's own behaviour (the group dropdown, the
      // preview-size slider, a scrolling list). The control lets go of focus so the next keys go to the wall too.
      const arrow = e.key.startsWith("Arrow");
      if (!arrow && t.closest("select, input")) return;
      if (arrow && t !== document.body && t.closest("select, input, button, a, [tabindex]")) (t as HTMLElement).blur?.();
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
          // PgUp / PgDn: channel up / down.
          case "PageUp":
            actions.channelStep(1);
            break;
          case "PageDown":
            actions.channelStep(-1);
            break;
          // + / = and - / _ (number pad + / − too): next / previous camera group.
          case "+":
          case "=":
            actions.groupStep(1);
            break;
          case "-":
          case "_":
            actions.groupStep(-1);
            break;
          case "]":
            actions.pageStep(1);
            break;
          case "[":
            actions.pageStep(-1);
            break;
          // Camera group also on , / . (and < / >).
          case ",":
          case "<":
            actions.groupStep(-1);
            break;
          case ".":
          case ">":
            actions.groupStep(1);
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
            // Same as ☰: the App decides (drawer below 1180px, collapse above).
            window.dispatchEvent(new CustomEvent("cctv:toggle-sidebar"));
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
            if (s.selected >= 0) actions.toggleFavourite(s.cells[s.selected]);
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
    // Capture phase: runs before any control's own handler, so the arrows' default (change the dropdown / slider,
    // scroll) can be cancelled.
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, []);

  // Sequence (patrol): one tick per dwell period (the 5s / 10s / 15s … control) in every mode — "rolling" swaps one
  // preview per tick, "page" flips a page, "pinned" queues the next channel. Re-armed when toggled, when the mode /
  // dwell / wall size changes, and after any manual change, so a manual change always gets a full dwell before the
  // sequence moves on.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const plan = () => ({ every: store.get().patrolSec * 1000, swaps: 1 });
    const arm = () => {
      clearInterval(timer);
      if (!store.get().patrol) return;
      const { every, swaps } = plan();
      timer = setInterval(() => actions.sequenceTick(swaps), every);
    };
    const sig = (s: ReturnType<typeof store.get>) => `${s.patrol}:${s.patrolSec}:${s.patrolMode}:${s.cells.length}:${s.pinned}`;
    let last = sig(store.get());
    let lastSwitch = store.get().switchedAt;
    arm();
    const unsub = store.subscribe(() => {
      const s = store.get();
      const now = sig(s);
      const manual = s.switchedAt !== lastSwitch && s.switchedAt !== lastSequenceTick();
      lastSwitch = s.switchedAt;
      if (now !== last || manual) {
        last = now;
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
