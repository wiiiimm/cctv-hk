import { useEffect, useState } from "react";

/** How long the CRT stays mounted after switch-off so the collapse-to-dot can play. */
const CRT_OFF_MS = 950;
import { useStore } from "../lib/store";
import { useControls } from "../hooks/useControls";
import { TopBar } from "./deck/TopBar";
import { Sidebar } from "./deck/Sidebar";
import { StatusBar } from "./deck/StatusBar";
import { VideoWall } from "./monitor/VideoWall";
import { CrtScreen } from "./crt/CrtScreen";

export default function App() {
  useControls();
  const mode = useStore((s) => s.mode);
  const lang = useStore((s) => s.lang);
  const theater = useStore((s) => s.theater);
  const [guideOpen, setGuideOpen] = useState(false);
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
    <div className={`app mode-${mode} lang-${lang}${theater ? " theater" : ""}${guideOpen ? " guide-open" : ""}`}>
      <TopBar onGuide={() => setGuideOpen((v) => !v)} />
      <div className="body">
        <Sidebar onPick={() => setGuideOpen(false)} />
        {/* CRT is a picture mode of the same viewer, not a separate screen. */}
        <main className="stage">
          {mode === "crt" || crtExit ? <CrtScreen exiting={mode !== "crt"} /> : <VideoWall />}
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
