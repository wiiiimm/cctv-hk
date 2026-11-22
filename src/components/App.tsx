import { useEffect, useRef, useState } from "react";

/** How long the CRT stays mounted after switch-off so the collapse-to-dot can play. */
const CRT_OFF_MS = 950;
import { actions, useStore } from "../lib/store";
import { useControls } from "../hooks/useControls";
import { TopBar } from "./deck/TopBar";
import { Sidebar } from "./deck/Sidebar";
import { StatusBar } from "./deck/StatusBar";
import { MobileBar } from "./deck/MobileBar";
import { ToastView } from "./ToastView";
import { initPwa } from "../lib/pwa";
import { NewsTicker } from "./deck/NewsTicker";
import { useMedia } from "../hooks/useMedia";
import { useWallGestures } from "../hooks/useWallGestures";
import { VideoWall } from "./monitor/VideoWall";
import { CrtScreen } from "./crt/CrtScreen";

export default function App() {
  useControls();
  // Offline support: service worker (production only) + offline / update notices.
  useEffect(() => initPwa(), []);
  const mode = useStore((s) => s.mode);
  const lang = useStore((s) => s.lang);
  const theater = useStore((s) => s.theater);
  const newsOn = useStore((s) => s.news);
  const [guideOpen, setGuideOpen] = useState(false);
  // One "show / hide sidebar" control at every width: a slide-out drawer below 1180px, a collapsible column above.
  // Re-rendered live when the window crosses a breakpoint (resize / rotate).
  const narrowNow = useMedia("(max-width: 1180px)");
  const phone = useMedia("(max-width: 760px)");
  const toggleSidebar = () => (window.innerWidth <= 1180 ? setGuideOpen((v) => !v) : actions.toggleTheater());
  const sidebarShown = narrowNow ? guideOpen : !theater;
  // Leaving drawer mode closes the drawer so it doesn't reappear stale.
  useEffect(() => {
    if (!narrowNow) setGuideOpen(false);
  }, [narrowNow]);
  useEffect(() => {
    const onToggle = () => toggleSidebar();
    // Open (never close): long-press and the phone bar's ⓘ want the camera details showing.
    const onOpen = () => (window.innerWidth <= 1180 ? setGuideOpen(true) : theater && actions.toggleTheater());
    window.addEventListener("cctv:toggle-sidebar", onToggle);
    window.addEventListener("cctv:open-sidebar", onOpen);
    return () => {
      window.removeEventListener("cctv:toggle-sidebar", onToggle);
      window.removeEventListener("cctv:open-sidebar", onOpen);
    };
  });
  const stageRef = useRef<HTMLElement>(null);
  useWallGestures(stageRef);
  // Landscape phone, full view: the bars hide after 3s for an edge-to-edge picture; a touch brings them back.
  const focused = useStore((s) => s.focused);
  const shortScreen = useMedia("(max-height: 500px)");
  const [chromeHidden, setChromeHidden] = useState(false);
  useEffect(() => {
    if (!(focused && shortScreen)) return setChromeHidden(false);
    let timer = setTimeout(() => setChromeHidden(true), 3000);
    const wake = () => {
      setChromeHidden(false);
      clearTimeout(timer);
      timer = setTimeout(() => setChromeHidden(true), 3000);
    };
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [focused, shortScreen]);
  // Esc closes the drawer first (before Esc's usual unpin / deselect).
  useEffect(() => {
    if (!guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setGuideOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [guideOpen]);
  // Keep the CRT on screen briefly after it is switched off so it can power down.
  const [lastMode, setLastMode] = useState(mode);
  const [crtExit, setCrtExit] = useState(false);
  if (mode !== lastMode) {
    setLastMode(mode);
    setCrtExit(lastMode === "crt");
  }
  useEffect(() => {
    if (!crtExit) return;
    const t = setTimeout(() => setCrtExit(false), CRT_OFF_MS);
    return () => clearTimeout(t);
  }, [crtExit]);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant-HK" : "en";
    document.title = lang === "zh" ? "香港閉路電視 · HK CCTV" : "HK CCTV · 香港閉路電視";
  }, [lang]);

  return (
    <div className={`app mode-${mode} lang-${lang}${theater ? " theater" : ""}${guideOpen ? " guide-open" : ""}${chromeHidden ? " chrome-hidden" : ""}`}>
      <TopBar onGuide={toggleSidebar} sidebarShown={sidebarShown} />
      <div className="body">
        <Sidebar onPick={() => setGuideOpen(false)} onClose={toggleSidebar} />
        {/* Drawer mode only (hidden on wide screens): click outside the drawer to close it. */}
        {guideOpen && <div className="drawer-backdrop" onClick={() => setGuideOpen(false)} aria-hidden />}
        {/* CRT is a picture mode of the same viewer, not a separate screen. */}
        {/* The viewer column: news ticker on top (part of the viewer, not over the sidebar), then the stage. */}
        <div className="viewer">
          {/* In CRT mode the ticker is drawn inside the tube instead (see compositor). */}
          {newsOn && mode !== "crt" && !crtExit && <NewsTicker />}
          <main className="stage" ref={stageRef}>
            {mode === "crt" || crtExit ? <CrtScreen exiting={mode !== "crt"} /> : <VideoWall />}
          </main>
        </div>
      </div>
      {phone ? <MobileBar /> : <StatusBar />}
      <ToastView />
    </div>
  );
}
