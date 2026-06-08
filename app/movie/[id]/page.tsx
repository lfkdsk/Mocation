import Link from "next/link";
import { notFound } from "next/navigation";
import Img from "@/components/Img";
import Map, { type MapPoint } from "@/components/Map";
import SceneTimeline from "@/components/SceneTimeline";
import Comments from "@/components/Comments";
import { movieGenres, countryName } from "@/lib/categories";
import { getMovie, search, type MoviePlot, type PersonRef } from "@/lib/mocation";

export const revalidate = 43200;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { movie } = await getMovie(id);
    return { title: movie.cname, description: movie.overview?.slice(0, 120) };
  } catch {
    return { title: "影视详情" };
  }
}

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let movie;
  try {
    ({ movie } = await getMovie(id));
  } catch {
    notFound();
  }

  const genres = movieGenres(movie.categories);
  const country = countryName(movie.countryId, movie.countryCname);
  const plots: MoviePlot[] = movie.plots || [];
  const points: MapPoint[] = plots.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    title: p.placeCname,
    subtitle: p.sceneName || p.areaCname,
    href: `/place/${p.placeId}`,
    cover: p.coverPath,
  }));

  // The movie endpoint doesn't return cast; the search index links movie↔people,
  // so we derive related people by searching the exact title.
  const cast: PersonRef[] = movie.cname
    ? await search(movie.cname)
        .then((r) => r.persons || [])
        .catch(() => [])
    : [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/movies" className="text-sm text-muted hover:text-accent ul-anim pb-0.5">
        ← 影视
      </Link>

      {/* Header */}
      <section className="mt-6 grid md:grid-cols-[300px_1fr] gap-8 md:gap-12">
        <div className="aspect-[2/3] rounded-sm bg-paper-2 ring-1 ring-line overflow-hidden max-w-[300px]">
          <Img src={movie.coverPath} alt={movie.cname} className="h-full w-full object-cover" />
        </div>
        <div>
          {movie.series ? <div className="label mb-3">剧集 Series</div> : <div className="label mb-3">电影 Film</div>}
          <h1 className="serif text-4xl sm:text-5xl font-bold leading-tight tracking-tight">{movie.cname}</h1>
          {movie.ename ? <p className="serif italic text-xl text-muted mt-2">{movie.ename}</p> : null}
          <p className="mt-5 text-sm text-muted tracking-wide">
            {[movie.year, country].filter(Boolean).join("  ·  ")}
          </p>
          {genres.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {genres.map((g) => (
                <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-paper-2 text-muted ring-1 ring-line">
                  {g}
                </span>
              ))}
            </div>
          ) : null}
          {movie.areas?.length ? (
            <p className="mt-5 text-sm">
              <span className="text-faint">取景城市：</span>
              <span className="text-muted">{movie.areas.map((a) => a.areaCname).join("、")}</span>
            </p>
          ) : null}
          {movie.overview ? (
            <p className="mt-6 text-[15px] leading-loose text-ink/90 max-w-2xl whitespace-pre-line">
              {movie.overview}
            </p>
          ) : null}
        </div>
      </section>

      {/* Cast / related people */}
      {cast.length ? (
        <section className="mt-14">
          <h2 className="serif text-2xl font-bold mb-6">相关影人</h2>
          <div className="flex flex-wrap gap-x-8 gap-y-6">
            {cast.map((p) => (
              <Link key={p.id} href={`/person/${p.id}`} className="group w-20 text-center">
                <div className="zoomable w-20 h-20 rounded-full mx-auto bg-paper-2 ring-1 ring-line overflow-hidden">
                  <Img src={p.coverPath} alt={p.cname} className="w-full h-full object-cover" />
                </div>
                <div className="mt-2 text-sm font-medium group-hover:text-accent transition-colors truncate">
                  {p.cname}
                </div>
                {p.ename ? <div className="text-[11px] text-faint truncate">{p.ename}</div> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Map */}
      {points.length ? (
        <section className="mt-16">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="kicker mb-2">Filming Map</div>
              <h2 className="serif text-2xl font-bold">取景地图</h2>
            </div>
            <span className="text-sm text-faint">{points.length} 处取景地</span>
          </div>
          <Map points={points} height={460} />
        </section>
      ) : null}

      {/* Location list — as a scene timeline (order of appearance) */}
      {plots.length ? (
        <section className="mt-16">
          <div className="flex items-end justify-between mb-7">
            <div>
              <div className="kicker mb-2">Scene by Scene</div>
              <h2 className="serif text-2xl font-bold">取景地清单 · 时间线</h2>
            </div>
            <span className="text-sm text-faint">按出场顺序 · 点击放大</span>
          </div>
          <SceneTimeline plots={plots} />
        </section>
      ) : null}

      <Comments type="movie" id={movie.id} />
    </div>
  );
}
