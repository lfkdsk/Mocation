import Link from "next/link";
import { notFound } from "next/navigation";
import Img from "@/components/Img";
import Map, { type MapPoint } from "@/components/Map";
import Comments from "@/components/Comments";
import { placeTypes } from "@/lib/categories";
import { getPlace } from "@/lib/mocation";

export const runtime = "edge";
export const revalidate = 43200;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { place } = await getPlace(id);
    return { title: place.cname, description: place.description?.slice(0, 120) };
  } catch {
    return { title: "取景地详情" };
  }
}

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let place;
  try {
    ({ place } = await getPlace(id));
  } catch {
    notFound();
  }

  const types = placeTypes(place.categories);
  const breadcrumb = [place.level1Cname, place.level2Cname, place.areaCname].filter(Boolean).join(" › ");
  const points: MapPoint[] =
    Number.isFinite(place.lat) && Number.isFinite(place.lng)
      ? [{ lat: place.lat, lng: place.lng, title: place.cname, subtitle: place.caddress, cover: place.coverPath }]
      : [];

  // Films are exposed via scenes[]; dedupe by movieId (a film can have many scenes here).
  const seenMovie = new Set<number>();
  const films = (place.scenes || []).filter((s) => {
    if (seenMovie.has(s.movieId)) return false;
    seenMovie.add(s.movieId);
    return true;
  });

  return (
    <div>
      {/* Cover hero — contained 16:9 to match the source aspect ratio */}
      <div className="mx-auto max-w-5xl px-5 pt-8">
        <div className="relative aspect-video rounded-sm overflow-hidden bg-paper-2 ring-1 ring-line">
          <Img src={place.coverPath} alt={place.cname} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 text-white">
            {breadcrumb ? <div className="text-xs tracking-widest uppercase opacity-90 mb-2">{breadcrumb}</div> : null}
            <h1 className="serif text-3xl sm:text-5xl font-bold tracking-tight drop-shadow-sm">{place.cname}</h1>
            {place.ename ? <p className="serif italic text-base sm:text-lg opacity-90 mt-1">{place.ename}</p> : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-10">
        <Link href="/places" className="text-sm text-muted hover:text-accent ul-anim pb-0.5">
          ← 取景地
        </Link>

        {/* Meta */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {types.map((t) => (
            <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-accent-soft text-accent font-medium">
              {t}
            </span>
          ))}
        </div>

        {place.caddress ? (
          <p className="mt-5 flex items-start gap-2 text-[15px] text-ink/90">
            <svg className="mt-1 shrink-0 text-accent" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span>{place.caddress}</span>
          </p>
        ) : null}
        {place.addressTips ? <p className="mt-2 text-sm text-muted pl-6">{place.addressTips}</p> : null}
        {place.phone ? <p className="mt-2 text-sm text-muted pl-6">电话：{place.phone}</p> : null}

        {/* Description */}
        {place.description ? (
          <div className="mt-8 max-w-2xl">
            <p className="text-[15px] leading-loose text-ink/90 whitespace-pre-line">{place.description}</p>
          </div>
        ) : null}
        {place.tips ? (
          <div className="mt-6 max-w-2xl border-l-2 border-accent/40 pl-4">
            <div className="kicker mb-1">Tips</div>
            <p className="text-sm leading-relaxed text-muted whitespace-pre-line">{place.tips}</p>
          </div>
        ) : null}

        {/* Map */}
        {points.length ? (
          <section className="mt-12">
            <h2 className="serif text-2xl font-bold mb-5">位置</h2>
            <Map points={points} height={380} zoom={14} />
          </section>
        ) : null}

        {/* Movies filmed here (derived from scenes) */}
        {films.length ? (
          <section className="mt-14">
            <h2 className="serif text-2xl font-bold mb-6">在此取景的影视</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-8">
              {films.map((m) => (
                <Link key={m.movieId} href={`/movie/${m.movieId}`} className="group block">
                  <div className="zoomable aspect-[2/3] rounded-sm bg-paper-2 ring-1 ring-line/70">
                    <Img src={m.coverPath} alt={m.movieCname} className="h-full w-full object-cover" />
                  </div>
                  <h3 className="serif text-sm font-semibold mt-2 group-hover:text-accent transition-colors line-clamp-1">
                    {m.movieCname}
                  </h3>
                  {m.sceneName ? <p className="text-[11px] text-faint mt-0.5 line-clamp-1">{m.sceneName}</p> : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <Comments type="place" id={place.id} />
      </div>
    </div>
  );
}
