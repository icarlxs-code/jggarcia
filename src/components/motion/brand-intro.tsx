import { useEffect, useRef, useState } from "react";

const ENTER_MS = 800;
const EXIT_MS = 2000;
const EXIT_BEFORE_END = 2;

let shared: HTMLVideoElement | null = null;

function videoEl() {
  if (typeof document === "undefined") return null;
  if (shared) return shared;
  const v = document.createElement("video");
  v.src = "/intro-logo.mp4?v=17";
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("aria-hidden", "true");
  Object.assign(v.style, {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    background: "#f6f4f4",
    display: "block",
  });
  shared = v;
  return v;
}

export function BrandIntro({ onFadeStart, onDone }: { onFadeStart: () => void; onDone: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"enter" | "play" | "exit">(() =>
    shared && shared.currentTime > 0.3 && !shared.ended ? "play" : "enter",
  );
  const done = useRef(false);
  const fadeRef = useRef(onFadeStart);
  const doneRef = useRef(onDone);
  fadeRef.current = onFadeStart;
  doneRef.current = onDone;

  function finish(ms = EXIT_MS) {
    if (done.current) return;
    done.current = true;
    fadeRef.current();
    setPhase("exit");
    window.setTimeout(() => doneRef.current(), ms);
  }

  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (root.classList.contains("is-lite")) {
        fadeRef.current();
        doneRef.current();
        return;
      }
    }
    const box = host.current;
    const v = videoEl();
    if (!box || !v) return;

    if (v.parentElement !== box) box.appendChild(v);
    v.muted = true;
    v.style.objectFit = "cover";
    v.style.width = "100%";
    v.style.height = "100%";
    if (!v.src.includes("v=17")) v.src = "/intro-logo.mp4?v=17";
    if (v.ended || (v.duration && v.currentTime >= v.duration - 0.05)) v.currentTime = 0;
    void v.play();

    const onTime = () => {
      const d = v.duration;
      if (!d || !Number.isFinite(d)) return;
      if (d - v.currentTime <= EXIT_BEFORE_END) finish(EXIT_MS);
    };
    const onEnded = () => finish(EXIT_MS);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);

    const show = window.setTimeout(() => setPhase("play"), 40);
    const fallback = window.setTimeout(() => finish(EXIT_MS), 12000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish(900);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(show);
      window.clearTimeout(fallback);
      window.removeEventListener("keydown", onKey);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <div
      className={`brand-intro ${phase === "exit" ? "is-exit" : ""}`}
      role="dialog"
      aria-label="Abertura JG Garcia"
      onClick={() => finish(900)}
    >
      <div ref={host} className="brand-intro-video" />
      <div className={`brand-veil ${phase}`} />
    </div>
  );
}

export const INTRO_ENTER_MS = ENTER_MS;
export const INTRO_EXIT_MS = EXIT_MS;
