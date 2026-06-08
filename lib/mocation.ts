// Server-side typed data layer for the Mocation API.
// All fetches run on the server (Server Components / route handlers), so there
// is no CORS issue and the browser never talks to the upstream directly.
// Caching (ISR `revalidate`) + retry/backoff is the core anti-ban strategy.

import { API_BASE, UPSTREAM_UA, UPSTREAM_TIMEOUT_MS, UPSTREAM_RETRIES, REVALIDATE } from "./config";

export interface Envelope<T> {
  code: number;
  msg: string | null;
  data: T;
}

export class McError extends Error {
  code: number;
  constructor(code: number, msg: string) {
    super(`Mocation API ${code}: ${msg}`);
    this.code = code;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Low-level fetch against the Mocation API.
 * @param path   path after /api/ (e.g. "movie/hot")
 * @param revalidate  ISR cache window in seconds (Next dedups + CDN-caches)
 */
export async function mfetch<T>(path: string, revalidate: number = REVALIDATE.list): Promise<T> {
  const url = `${API_BASE}/${path.replace(/^\//, "")}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UPSTREAM_UA, Accept: "application/json" },
        signal: ctrl.signal,
        next: { revalidate },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Envelope<T>;
      if (json.code !== 0) throw new McError(json.code, json.msg || "请求异常");
      return json.data;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      // Don't retry genuine API-level errors (login required, bad params).
      if (err instanceof McError) throw err;
      if (attempt < UPSTREAM_RETRIES) await sleep(600 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("upstream fetch failed");
}

/* ----------------------------- shared types ----------------------------- */

export interface AreaRef {
  areaId: number;
  areaCname: string;
  areaEname: string;
}

export interface MovieListItem {
  id: number;
  cname: string;
  ename: string;
  coverPath: string;
  year: number;
  countryId: number;
  countryCname: string;
  countryEname?: string;
  type: number;
  categories: number[];
  placeIds: number[];
  areas: AreaRef[];
  series?: boolean;
  initial?: string;
}

export interface MoviePlot {
  placeId: number;
  placeCname: string;
  placeEname: string;
  lat: number;
  lng: number;
  assType: number;
  areaId: number;
  areaCname: string;
  upLevelAreaCname?: string;
  sceneId: number;
  sceneName: string;
  episode: number;
  position: number;
  milliSecond?: number | null;
  coverPath: string;
}

export interface MovieDetail extends MovieListItem {
  overview?: string;
  plots?: MoviePlot[];
}

export interface PlaceListItem {
  id: number;
  cname: string;
  ename: string;
  coverPath: string;
  lat: number;
  lng: number;
  assType: number;
  areaId: number;
  areaCname: string;
  areaEname?: string;
  level1Id?: number;
  level1Cname?: string;
  movies: { id: number; cname: string; ename: string }[];
  categories: number[];
}

export interface PlaceMovieRef {
  id: number;
  cname: string;
  ename: string;
  coverPath?: string;
}

export interface PlaceDetail {
  id: number;
  cname: string;
  ename: string;
  coverPath: string;
  mapPath?: string;
  staticMapUrl?: string;
  lat: number;
  lng: number;
  areaId: number;
  caddress?: string;
  eaddress?: string;
  addressTips?: string;
  phone?: string;
  categories: number[];
  description?: string;
  tips?: string;
  rmmDesc?: string;
  areaCname?: string;
  level1Cname?: string;
  level2Cname?: string;
  level3Cname?: string;
  movies?: PlaceMovieRef[];
  // Each "scene" links the place to a movie/episode that filmed here.
  scenes?: {
    movieId: number;
    movieCname: string;
    movieEname?: string;
    coverPath?: string;
    year?: number;
    sceneName?: string;
  }[];
}

export interface AreaDetail {
  id: number;
  cname: string;
  ename: string;
  coverPath: string;
  lat: number;
  lng: number;
  level: number;
  level1Cname?: string;
  rmmCname?: string;
  rmmEname?: string;
  description?: string;
}

export interface AreaMovie {
  id: number;
  cname: string;
  ename: string;
  coverPath: string;
  placeCount: number;
}

export interface RouteRmm {
  id: number;
  routeId: number;
  title: string;
  picPath: string;
  description: string;
}

export interface PersonRef {
  id: number;
  cname: string;
  ename: string;
  countryId?: number;
  countryCname?: string;
  coverPath?: string;
}

export interface ArticleRef {
  id: number;
  title: string;
  subTitle?: string;
  digest?: string;
  coverPath?: string;
}

export interface AreaRefCard {
  id: number;
  cname: string;
  ename: string;
  coverPath?: string;
  level1Cname?: string;
}

export interface SearchResult {
  movies: MovieListItem[];
  places: PlaceListItem[];
  areas: AreaRefCard[];
  routes: RouteRmm[];
  articles: ArticleRef[];
  persons: PersonRef[];
}

export interface PersonDetail {
  id: number;
  cname: string;
  ename: string;
  oname?: string;
  alias?: string;
  coverPath: string;
  sex?: number;
  birthday?: number | null;
  countryId?: number;
  countryCname?: string;
  desc?: string;
  professions?: number[];
  movies?: MovieListItem[];
}

export interface Comment {
  id: number;
  content: string;
  userName?: string;
  userAvatar?: string;
  createTime?: string;
  likeCount?: number;
}

/* ------------------------------- fetchers ------------------------------- */

export interface HomeData {
  hotMovies: MovieListItem[];
  latestMovies: MovieListItem[];
  places: PlaceListItem[];
  areas: AreaDetail[];
  routes: RouteRmm[];
  banners: { id: number; picPath?: string; coverPath?: string; title?: string; link?: string }[];
}

export const getHome = () => mfetch<HomeData>("home/data", REVALIDATE.home);

export const getCoopen = () => mfetch<{ movieCount: number; placeCount: number }>("coopen/data", REVALIDATE.home);

/** Popular movies. `size` is supported by the upstream (default page 0). */
export const getMoviesHot = (size = 200) =>
  mfetch<{ total: number; movies: MovieListItem[] }>(
    `movie/hot-and-default?page=0&size=${size}`,
    REVALIDATE.list,
  );

export const getMoviesLatest = () => mfetch<{ movies: MovieListItem[] }>("movie/latest", REVALIDATE.list);

export const getMovie = (id: number | string) =>
  mfetch<{ movie: MovieDetail; favoriteId: number | null }>(`movie/${id}`, REVALIDATE.detail);

export const getMovieRoutes = (id: number | string) =>
  mfetch<{ routes: RouteRmm[] }>(`movie/${id}/route`, REVALIDATE.detail);

/** Popular places. `total` is the real catalog size; up to 500 rows returned. */
export const getPlacesHot = (size = 500) =>
  mfetch<{ total: number; places: PlaceListItem[] }>(
    `place/hot-and-default?page=0&size=${size}`,
    REVALIDATE.list,
  );

export const getPlace = (id: number | string) =>
  mfetch<{ place: PlaceDetail; favoriteId: number | null }>(`place/${id}`, REVALIDATE.detail);

export const getArea = (id: number | string) =>
  mfetch<{ area: AreaDetail; favoriteId: number | null }>(`area/${id}`, REVALIDATE.detail);

export const getAreaMovies = (id: number | string) =>
  mfetch<{ total: number; movies: AreaMovie[] }>(`area/${id}/movie`, REVALIDATE.detail);

export const getPerson = (id: number | string) =>
  mfetch<{ person: PersonDetail; favoriteId: number | null }>(`person/${id}`, REVALIDATE.detail);

/**
 * Real global search. NOTE: the working param is `key` (not `keyword`) — the
 * latter silently returns empty. Covers movies / places / areas / routes /
 * articles / persons across the full catalog.
 */
export const search = (keyword: string) =>
  mfetch<SearchResult>(
    `search?key=${encodeURIComponent(keyword)}&page=0&size=30`,
    REVALIDATE.search,
  );

export const getComments = (type: string, id: number | string) =>
  mfetch<{ total: number; list: Comment[] }>(
    `comment/list?type=${encodeURIComponent(type)}&id=${id}`,
    REVALIDATE.search,
  );
