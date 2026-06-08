// Coordinate conversion: Chinese GCJ-02 / BD-09 -> WGS-84.
// Needed because upstream coordinates are in GCJ-02 ("Mars" datum) while
// Leaflet + OSM/Carto tiles expect WGS-84. Classic eviltransform algorithm.

import { COORD_DATUM } from "./config";

const PI = Math.PI;
const A = 6378245.0; // semi-major axis (Krasovsky 1940)
const EE = 0.00669342162296594323; // eccentricity squared
const X_PI = (PI * 3000.0) / 180.0;

function outOfChina(lng: number, lat: number): boolean {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}

function transformLat(lng: number, lat: number): number {
  let ret =
    -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(lng: number, lat: number): number {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

/** GCJ-02 -> WGS-84 */
export function gcj02ToWgs84(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat];
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return [lng - dLng, lat - dLat];
}

/** WGS-84 -> GCJ-02 (inverse of gcj02ToWgs84) */
export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat];
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return [lng + dLng, lat + dLat];
}

/** BD-09 -> GCJ-02 */
function bd09ToGcj02(lng: number, lat: number): [number, number] {
  const x = lng - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  return [z * Math.cos(theta), z * Math.sin(theta)];
}

/** GCJ-02 -> BD-09 */
function gcj02ToBd09(lng: number, lat: number): [number, number] {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006];
}

/**
 * Convert a WGS-84 map coordinate to the upstream's datum for querying
 * (inverse of toWgs84LatLng). Returns [lat, lng].
 */
export function fromWgs84LatLng(lat: number, lng: number): [number, number] {
  if (COORD_DATUM === "wgs84") return [lat, lng];
  const [gLng, gLat] = wgs84ToGcj02(lng, lat);
  if (COORD_DATUM === "bd09") {
    const [bLng, bLat] = gcj02ToBd09(gLng, gLat);
    return [bLat, bLng];
  }
  return [gLat, gLng];
}

/**
 * Convert an upstream coordinate to WGS-84 according to the configured datum.
 * Returns [lat, lng] (Leaflet order).
 */
export function toWgs84LatLng(lat: number, lng: number): [number, number] {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [lat, lng];
  if (COORD_DATUM === "wgs84") return [lat, lng];
  if (COORD_DATUM === "bd09") {
    const [gLng, gLat] = bd09ToGcj02(lng, lat);
    const [wLng, wLat] = gcj02ToWgs84(gLng, gLat);
    return [wLat, wLng];
  }
  const [wLng, wLat] = gcj02ToWgs84(lng, lat);
  return [wLat, wLng];
}
