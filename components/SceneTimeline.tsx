"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Img from "./Img";
import { proxied } from "@/lib/img";
import type { MoviePlot } from "@/lib/mocation";

/**
 * Scene timeline for a film/series: locations in the order they appear
 * (sorted by episode, then `position` — the scene's place in the story).
 * Wide 16:9 stills (movies are landscape); click a still to enlarge.
 */
/** `position` is the scene's start time in seconds → format as a timecode. */
function timecode(p: MoviePlot): string | null {
  const sec = p.milliSecond != null ? Math.round(p.milliSecond / 1000) : p.position;
  if (!sec || sec <= 0) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function SceneTimeline({ plots }: { plots: MoviePlot[] }) {
  const [active, setActive] = useState<MoviePlot | null>(null);

  const ordered = [...plots].sort(
    (a, b) => (a.episode ?? 0) - (b.episode ?? 0) || (a.position ?? 0) - (b.position ?? 0),
  );
  const multiEpisode = new Set(ordered.map((p) => p.episode ?? 0)).size > 1;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active]);

  let lastEp = -999;

  return (
    <>
      <ol className="relative">
        {/* timeline rail */}
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-line" aria-hidden />

        {ordered.map((p, i) => {
          const showEp = multiEpisode && p.episode !== lastEp;
          lastEp = p.episode ?? 0;
          const tc = timecode(p);
          return (
            <li key={`${p.sceneId}-${i}`} className="relative pl-12 pb-9 last:pb-0">
              {/* node */}
              <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper text-xs font-semibold ring-4 ring-paper">
                {i + 1}
              </span>

              {showEp ? (
                <div className="label mb-3">第 {p.episode} 集</div>
              ) : null}

              <div className="grid sm:grid-cols-[minmax(0,440px)_1fr] gap-x-6 gap-y-3 items-start">
                <button
                  type="button"
                  onClick={() => p.coverPath && setActive(p)}
                  className="zoomable group relative block aspect-video w-full rounded-sm bg-paper-2 ring-1 ring-line/70 overflow-hidden cursor-zoom-in"
                  aria-label={`放大 ${p.sceneName || p.placeCname}`}
                >
                  <Img src={p.coverPath} alt={p.sceneName || p.placeCname} className="h-full w-full object-cover" />
                  {tc ? (
                    <span className="absolute left-2 bottom-2 bg-black/65 text-white text-[11px] font-medium px-1.5 py-0.5 rounded tabular-nums">
                      {tc}
                    </span>
                  ) : null}
                  <span className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/55 text-white rounded-full p-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>

                <div className="py-0.5">
                  {p.sceneName ? (
                    <h3 className="serif text-lg font-semibold leading-snug">{p.sceneName}</h3>
                  ) : null}
                  <Link
                    href={`/place/${p.placeId}`}
                    className="inline-block mt-1 text-sm text-muted hover:text-accent ul-anim pb-0.5"
                  >
                    {p.placeCname}
                  </Link>
                  <div className="text-xs text-faint mt-1.5">
                    {[p.upLevelAreaCname, p.areaCname].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Lightbox */}
      {active ? (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-10"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute top-5 right-5 text-white/80 hover:text-white"
            aria-label="关闭"
            onClick={() => setActive(null)}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
          <figure className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxied(active.coverPath)}
              alt={active.sceneName || active.placeCname}
              referrerPolicy="no-referrer"
              className="w-full max-h-[80vh] object-contain rounded-sm"
            />
            <figcaption className="mt-4 text-center text-white">
              {active.sceneName ? <div className="serif text-lg">{active.sceneName}</div> : null}
              <div className="text-sm text-white/70 mt-1">
                {active.placeCname}
                {active.areaCname ? ` · ${active.areaCname}` : ""}
              </div>
              <Link
                href={`/place/${active.placeId}`}
                className="inline-block mt-3 text-sm text-white/90 underline underline-offset-4 hover:text-white"
              >
                查看取景地详情 →
              </Link>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}
