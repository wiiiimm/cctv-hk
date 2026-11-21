import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { useControls } from "../hooks/useControls";
import { TopBar } from "./deck/TopBar";
import { ChannelGuide } from "./deck/ChannelGuide";
import { FocusPanel } from "./deck/FocusPanel";
import { StatusBar } from "./deck/StatusBar";
import { VideoWall } from "./monitor/VideoWall";
import { CrtScreen } from "./crt/CrtScreen";

export default function App() {
  useControls();
  const mode = useStore((s) => s.mode);
  const lang = useStore((s) => s.lang);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant-HK" : "en";
    document.title = lang === "zh" ? "香港閉路電視 · HK CCTV" : "HK CCTV · 香港閉路電視";
  }, [lang]);

  return (
    <div className={`app mode-${mode} lang-${lang}${guideOpen ? " guide-open" : ""}`}>
      <TopBar onGuide={() => setGuideOpen((v) => !v)} />
      <div className="body">
        <ChannelGuide onPick={() => setGuideOpen(false)} />
        {/* CRT is a picture mode of the same viewer, not a separate screen. */}
        <main className="stage">{mode === "crt" ? <CrtScreen /> : <VideoWall />}</main>
        <FocusPanel />
      </div>
      <StatusBar />
    </div>
  );
}
