import Link from "next/link";
import { notFound } from "next/navigation";
import Img from "@/components/Img";
import Map, { type MapPoint } from "@/components/Map";
import { getArea, getAreaMovies } from "@/lib/mocation";

export const revalidate = 43200;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { area } = await getArea(id);
    return { title: area.cname };
  } catch {
    return { title: "地区" };
  }
}

export default async function AreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let area;
  try {
    ({ area } = await getArea(id));
  } catch {
    notFound();
  }
  const movies = await getAreaMovies(id).catch(() => ({ movies: [], total: 0 }));

  const points: MapPoint[] =
    Number.isFinite(area.lat) && Number.isFinite(area.lng)
      ? [{ lat: area.lat, lng: area.lng, title: area.cname, cover: area.coverPath }]
      : [];

  return (
    <div>
      <div className="mx-auto max-w-5xl px-5 pt-8">
        <div className="relative aspect-video rounded-sm overflow-hidden bg-paper-2 ring-1 ring-line">
          <Img src={area.coverPath} alt={area.cname} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 text-white">
            {area.level1Cname ? (
              <div className="text-xs tracking-widest uppercase opacity-90 mb-2">{area.level1Cname}</div>
            ) : null}
            <h1 className="serif text-3xl sm:text-5xl font-bold tracking-tight drop-shadow-sm">{area.cname}</h1>
            {area.ename ? <p className="serif italic text-base sm:text-lg opacity-90 mt-1">{area.ename}</p> : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-10">
        <Link href="/search" className="text-sm text-muted hover:text-accent ul-anim pb-0.5">
          ← 搜索
        </Link>

        {area.description ? (
          <p className="mt-6 text-[15px] leading-loose text-ink/90 max-w-2xl whitespace-pre-line">
            {area.description}
          </p>
        ) : null}

        {points.length ? (
          <section className="mt-10">
            <h2 className="serif text-2xl font-bold mb-5">位置</h2>
            <Map points={points} height={360} zoom={9} />
          </section>
        ) : null}

        {movies.movies?.length ? (
          <section className="mt-14">
            <h2 className="serif text-2xl font-bold mb-6">
              在此取景的影视 <span className="text-faint text-base font-normal">({movies.total})</span>
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-9">
              {movies.movies.map((m) => (
                <Link key={m.id} href={`/movie/${m.id}`} className="group block">
                  <div className="zoomable aspect-[2/3] rounded-sm bg-paper-2 ring-1 ring-line/70">
                    <Img src={m.coverPath} alt={m.cname} className="h-full w-full object-cover" />
                  </div>
                  <h3 className="serif text-sm font-semibold mt-2 group-hover:text-accent transition-colors line-clamp-1">
                    {m.cname}
                  </h3>
                  {m.placeCount ? <p className="text-[11px] text-faint mt-0.5">{m.placeCount} 处取景地</p> : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
