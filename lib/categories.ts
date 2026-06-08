// Category dictionaries — extracted verbatim from the app's bundled assets
// (assets/movieCategory.json, assets/placeCategory.json).

/**
 * Movie genre id -> name. IDs 0–9 come from the app's bundled movieCategory.json;
 * 10+ were recovered by cross-referencing well-known films' genre IDs from the
 * live API with their known genres (16/18/21 confirmed against the iOS app).
 * ID 20 never appears in any movie, so it's intentionally absent.
 */
export const MOVIE_GENRES: Record<number, string> = {
  0: "爱情",
  1: "喜剧",
  2: "科幻",
  3: "动作",
  4: "悬疑",
  5: "犯罪",
  6: "青春",
  7: "惊悚",
  8: "文艺",
  9: "励志",
  10: "剧情",
  11: "动画",
  12: "战争",
  13: "奇幻",
  14: "传记",
  15: "情色",
  16: "家庭",
  17: "音乐",
  18: "黑帮",
  19: "同性",
  21: "灾难",
  22: "武侠",
  23: "西部",
  24: "冒险",
  25: "历史",
  26: "歌舞",
  27: "运动",
};

/** Place type id -> name (placeCategory.category). */
export const PLACE_TYPES: Record<number, string> = {
  0: "旅游景点",
  1: "历史建筑",
  2: "餐饮",
  3: "商铺",
  4: "自然风光",
  5: "民居",
  6: "酒店",
  7: "地标",
  8: "宗教场所",
  9: "街道",
  10: "影视基地",
  11: "公园",
  12: "演艺场所",
  13: "展馆",
  14: "交通站",
  15: "商用建筑",
};

/** Country id -> name (shared by movie & place dictionaries). */
export const COUNTRIES: Record<number, string> = {
  6: "中国大陆",
  7: "美国",
  8: "英国",
  13: "韩国",
  16: "日本",
  49: "意大利",
  50: "德国",
  51: "法国",
  77: "中国香港",
  79: "中国台湾",
};

export function movieGenres(ids?: number[] | null): string[] {
  return (ids || []).map((i) => MOVIE_GENRES[i]).filter(Boolean);
}
export function placeTypes(ids?: number[] | null): string[] {
  return (ids || []).map((i) => PLACE_TYPES[i]).filter(Boolean);
}
export function countryName(id?: number | null, fallback?: string | null): string {
  return (id != null && COUNTRIES[id]) || fallback || "";
}

/** Search tabs / entity kinds used across the UI. */
export const SEARCH_KINDS = [
  { key: "movies", label: "电影" },
  { key: "places", label: "取景地" },
  { key: "areas", label: "地区" },
  { key: "routes", label: "路线" },
  { key: "articles", label: "文章" },
  { key: "persons", label: "人物" },
] as const;
