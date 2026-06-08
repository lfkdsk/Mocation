"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { toWgs84LatLng, fromWgs84LatLng } from "@/lib/coords";
import { proxied } from "@/lib/img";
import { placeTypes } from "@/lib/categories";
import type { PlaceListItem } from "@/lib/mocation";

type NearbyPlace = PlaceListItem & { distance?: number };

const DEFAULT_CENTER: [number, number] = [39.9042, 116.4074]; // Beijing (WGS-84)
const SIZE = 60;
const MAX_AUTO_PAGES = 5; // auto-fill up to ~300 places per viewport, then fall back to the button
const ROUND = 2; // ~1.1km — coarse query key so nearby pans reuse cache

export default function ExploreMap() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queryRef = useRef<{ km: number; lat: string; lng: string } | null>(null);
  const cacheRef = useRef<Map<string, NearbyPlace[]>>(new Map()); // client-side memo

  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  async function fetchPage(km: number, lat: string, lng: string, pg: number, signal?: AbortSignal) {
    const key = `${km}:${lat}:${lng}:${pg}`;
    const cached = cacheRef.current.get(key);
    if (cached) return cached;
    const r = await fetch(`/api/m/place/nearby?distance=${km}&lat=${lat}&lng=${lng}&page=${pg}&size=${SIZE}`, {
      signal,
    });
    const j = await r.json();
    const list: NearbyPlace[] = (j?.data?.places || []).filter(
      (p: NearbyPlace) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
    );
    if (cacheRef.current.size > 200) cacheRef.current.clear();
    cacheRef.current.set(key, list);
    return list;
  }

  function addMarkers(L: any, list: NearbyPlace[]) {
    list.forEach((p) => {
      const [wlat, wlng] = toWgs84LatLng(p.lat, p.lng);
      const m = L.marker([wlat, wlng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;border-radius:50%;background:#b23a2e;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
          iconSize: [12, 12],
        }),
      });
      const cover = p.coverPath
        ? `<img src="${proxied(p.coverPath)}" referrerpolicy="no-referrer" style="width:100%;height:96px;object-fit:cover;border-radius:4px;margin-bottom:6px;display:block;background:#f3f0e9"/>`
        : "";
      m.bindPopup(
        `<div style="width:170px">${cover}<div style="font-weight:600;font-size:13px">${p.cname}</div>${
          p.areaCname
            ? `<div style="color:#6f665a;font-size:12px;margin:2px 0 4px">${p.areaCname}${
                p.distance != null ? ` · ${p.distance.toFixed(1)}km` : ""
              }</div>`
            : ""
        }<a href="/place/${p.id}" style="color:#b23a2e;font-size:12px">查看取景地 →</a></div>`,
        { minWidth: 170 },
      );
      layerRef.current.addLayer(m);
    });
  }

  // Fresh query for the current viewport: load page 0 (replaces results), then
  // auto-fill the remaining pages until a short page (exhausted) or the cap.
  // A new pan aborts `ac`, and every state write is guarded by `ac.signal`, so a
  // superseded auto-fill can't leak markers/loading into the new viewport.
  async function newQuery(L: any, map: any) {
    const c = map.getCenter();
    const [glat, glng] = fromWgs84LatLng(c.lat, c.lng);
    const ne = map.getBounds().getNorthEast();
    const km = Math.min(800, Math.max(1, Math.round(map.distance(c, ne) / 1000)));
    const lat = glat.toFixed(ROUND);
    const lng = glng.toFixed(ROUND);
    queryRef.current = { km, lat, lng };
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setPage(0);
    setHasMore(false);
    try {
      const first = await fetchPage(km, lat, lng, 0, ac.signal);
      if (ac.signal.aborted) return;
      layerRef.current.clearLayers();
      addMarkers(L, first);
      setPlaces(first);

      // Keep pulling pages until one comes back short, or we hit the cap.
      let pg = 0;
      let last = first;
      while (last.length >= SIZE && pg + 1 < MAX_AUTO_PAGES) {
        pg += 1;
        const list = await fetchPage(km, lat, lng, pg, ac.signal);
        if (ac.signal.aborted) return;
        addMarkers(L, list);
        setPlaces((prev) => [...prev, ...list]);
        setPage(pg);
        last = list;
      }
      // Hit the cap with a still-full page? leave the manual button as an escape.
      setHasMore(last.length >= SIZE);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setPlaces([]);
        setHasMore(false);
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }

  // Manual continuation past the auto-fill cap. Rides the current query's
  // AbortController so a pan cancels an in-flight click instead of appending
  // stale pages to the new viewport.
  async function loadMore() {
    const q = queryRef.current;
    const L = LRef.current;
    const ac = abortRef.current;
    if (!q || !L || loadingMore) return;
    const next = page + 1;
    setLoadingMore(true);
    try {
      const list = await fetchPage(q.km, q.lat, q.lng, next, ac?.signal);
      if (ac?.signal.aborted) return;
      addMarkers(L, list);
      setPlaces((prev) => [...prev, ...list]);
      setPage(next);
      setHasMore(list.length >= SIZE);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("当前浏览器不支持定位");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { duration: 0.8 });
      },
      (err) => {
        setLocating(false);
        setGeoError(err.code === 1 ? "定位被拒绝，请在浏览器开启定位权限" : "无法获取当前位置");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(ref.current, { scrollWheelZoom: true, zoomControl: true });
      mapRef.current = map;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);

      map.on("moveend", () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => newQuery(L, map), 550);
      });

      setTimeout(() => {
        map.invalidateSize();
        map.setView(DEFAULT_CENTER, 12);
        newQuery(L, map);
      }, 150);
      if (ref.current && "ResizeObserver" in window) {
        new ResizeObserver(() => map.invalidateSize()).observe(ref.current);
      }
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flyTo(p: NearbyPlace) {
    const [wlat, wlng] = toWgs84LatLng(p.lat, p.lng);
    mapRef.current?.flyTo([wlat, wlng], Math.max(mapRef.current.getZoom(), 15), { duration: 0.6 });
  }

  return (
    <div className="grid lg:grid-cols-[360px_1fr] h-[calc(100vh-4rem)]">
      <aside className="order-2 lg:order-1 overflow-y-auto border-t lg:border-t-0 lg:border-r border-line">
        <div className="px-5 py-4 sticky top-0 bg-paper/90 backdrop-blur border-b border-line z-10">
          <div className="kicker flex items-center gap-2">
            In view
            {loading ? (
              <span className="inline-block w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            ) : null}
          </div>
          <div className="serif text-lg font-bold">这一带的取景地 · {places.length}</div>
          <div className="text-[11px] text-faint mt-0.5">拖动地图，自动搜索该区域取景地</div>
        </div>
        <ul className="divide-y divide-line">
          {places.map((p, i) => (
            <li key={`${p.id}-${i}`}>
              <div className="flex gap-3 px-5 py-3 hover:bg-paper-2/60 transition-colors">
                <button
                  onClick={() => flyTo(p)}
                  className="zoomable w-20 h-14 shrink-0 rounded-sm bg-paper-2 ring-1 ring-line overflow-hidden"
                  aria-label="在地图上定位"
                >
                  {p.coverPath ? (
                    <img src={proxied(p.coverPath)} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover" />
                  ) : null}
                </button>
                <div className="min-w-0 flex-1">
                  <Link href={`/place/${p.id}`} className="serif text-[14px] font-semibold leading-snug hover:text-accent line-clamp-1">
                    {p.cname}
                  </Link>
                  <div className="text-[11px] text-faint mt-0.5 line-clamp-1">
                    {[p.areaCname, placeTypes(p.categories)[0], p.distance != null ? `${p.distance.toFixed(1)}km` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {p.movies?.[0] ? <div className="text-[11px] text-muted mt-0.5 line-clamp-1">《{p.movies[0].cname}》</div> : null}
                </div>
              </div>
            </li>
          ))}
          {!loading && !places.length ? (
            <li className="px-5 py-8 text-sm text-faint">该区域暂无收录的取景地，试试别处</li>
          ) : null}
        </ul>
        {hasMore ? (
          <div className="p-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-2.5 text-sm rounded-sm ring-1 ring-line hover:bg-paper-2 hover:text-accent transition-colors disabled:opacity-60"
            >
              {loadingMore ? "加载中…" : "加载更多 ↓"}
            </button>
          </div>
        ) : null}
      </aside>

      <div className="order-1 lg:order-2 relative h-[55vh] lg:h-full w-full">
        <div ref={ref} className="absolute inset-0 z-0" />
        <button
          onClick={locate}
          disabled={locating}
          aria-label="跳转到我的位置"
          title="跳转到我的位置"
          className="absolute z-[1000] right-4 bottom-8 h-11 w-11 rounded-full bg-paper/95 ring-1 ring-line shadow-md flex items-center justify-center text-ink hover:text-accent hover:bg-paper transition-colors"
        >
          {locating ? (
            <span className="inline-block w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            </svg>
          )}
        </button>
        {geoError ? (
          <div className="absolute z-[1000] right-4 bottom-20 max-w-[220px] text-xs bg-ink text-paper px-3 py-2 rounded-md shadow-lg">
            {geoError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
