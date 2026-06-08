"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { toWgs84LatLng } from "@/lib/coords";
import { proxied } from "@/lib/img";

export interface MapPoint {
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  href?: string;
  cover?: string;
}

export default function Map({
  points,
  height = 420,
  zoom = 12,
}: {
  points: MapPoint[];
  height?: number;
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;

      const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      const latlngs = valid.map((p) => toWgs84LatLng(p.lat, p.lng));

      const map = L.map(ref.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(map);

      const pin = (n?: number) =>
        L.divIcon({
          className: "",
          html: `<div style="transform:translate(-50%,-100%)">
            <div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              background:#b23a2e;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;
              justify-content:center;border:2px solid #fff;">
              <span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;">${
                n ?? ""
              }</span></div></div>`,
          iconSize: [26, 26],
        });

      valid.forEach((p, i) => {
        const [lat, lng] = latlngs[i];
        const m = L.marker([lat, lng], { icon: pin(valid.length > 1 ? i + 1 : undefined) }).addTo(map);
        const link = p.href
          ? `<a href="${p.href}" style="color:#b23a2e;font-size:12px;">查看详情 →</a>`
          : "";
        const cover = p.cover
          ? `<img src="${proxied(p.cover)}" referrerpolicy="no-referrer" loading="lazy"
               style="width:100%;height:104px;object-fit:cover;border-radius:4px;margin-bottom:6px;display:block;background:#f3f0e9" />`
          : "";
        m.bindPopup(
          `<div style="width:180px">${cover}<div style="font-weight:600;font-size:13px;margin-bottom:2px">${p.title}</div>${
            p.subtitle ? `<div style="color:#6f665a;font-size:12px;margin-bottom:4px">${p.subtitle}</div>` : ""
          }${link}</div>`,
          { minWidth: 180 },
        );
      });

      if (latlngs.length === 1) {
        map.setView(latlngs[0], zoom);
      } else if (latlngs.length > 1) {
        map.fitBounds(latlngs as [number, number][], { padding: [40, 40], maxZoom: 14 });
      } else {
        map.setView([35.86, 104.19], 4); // China overview fallback
      }
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      if (m?.remove) m.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  return <div ref={ref} style={{ height }} className="w-full rounded-sm ring-1 ring-line z-0" />;
}
