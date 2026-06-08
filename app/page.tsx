import Link from "next/link";
import Img from "@/components/Img";
import MovieCard from "@/components/MovieCard";
import PlaceCard from "@/components/PlaceCard";
import SectionTitle from "@/components/SectionTitle";
import { movieGenres, countryName } from "@/lib/categories";
import { getHome, getCoopen } from "@/lib/mocation";

export const revalidate = 1800;

export default async function HomePage() {
  const [home, coopen] = await Promise.all([
    getHome(),
    getCoopen().catch(() => null),
  ]);

  const hero = home.hotMovies?.[0];
  const restHot = (home.hotMovies || []).slice(1, 13);
  const places = (home.places || []).slice(0, 8);
  const latest = (home.latestMovies || []).slice(0, 12);
  const heroGenres = hero ? movieGenres(hero.categories).join(" / ") : "";

  return (
    <div className="mx-auto max-w-6xl px-5">
      {/* Hero ----------------------------------------------------------- */}
      {hero ? (
        <section className="pt-10 sm:pt-16 pb-14">
          <div className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
            <Link href={`/movie/${hero.id}`} className="zoomable block w-full max-w-[360px] mx-auto md:mx-0 aspect-[2/3] rounded-sm bg-paper-2 ring-1 ring-line order-1 md:order-none">
              <Img src={hero.coverPath} alt={hero.cname} className="h-full w-full object-cover" />
            </Link>
            <div>
              <div className="label mb-4">本期精选 · Featured</div>
              <h1 className="serif text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
                {hero.cname}
              </h1>
              {hero.ename ? (
                <p className="serif italic text-lg text-muted mt-3">{hero.ename}</p>
              ) : null}
              <p className="mt-5 text-sm text-muted tracking-wide">
                {[hero.year, countryName(hero.countryId, hero.countryCname), heroGenres]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href={`/movie/${hero.id}`}
                  className="inline-flex items-center gap-2 whitespace-nowrap bg-ink text-paper text-sm px-5 py-2.5 rounded-sm hover:bg-accent transition-colors"
                >
                  探索取景地
                  {hero.placeIds?.length ? (
                    <span className="opacity-70">· {hero.placeIds.length} 处</span>
                  ) : null}
                </Link>
                <Link href="/movies" className="text-sm text-muted hover:text-accent ul-anim pb-0.5 whitespace-nowrap">
                  更多影视 →
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Stats ---------------------------------------------------------- */}
      {coopen ? (
        <section className="border-y border-line py-5 flex items-center justify-center gap-10 sm:gap-16 text-center">
          <Stat n={coopen.movieCount} label="影视作品" />
          <span className="w-px h-8 bg-line" />
          <Stat n={coopen.placeCount} label="取景地" />
        </section>
      ) : null}

      {/* Hot movies ----------------------------------------------------- */}
      <section className="py-16">
        <SectionTitle kicker="Now Trending" title="热门影视" href="/movies" />
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-9">
          {restHot.map((m) => (
            <MovieCard key={m.id} movie={m} />
          ))}
        </div>
      </section>

      {/* Featured places ------------------------------------------------ */}
      {places.length ? (
        <section className="py-6 pb-16">
          <SectionTitle kicker="On Location" title="取景地精选" href="/places" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-9">
            {places.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Latest --------------------------------------------------------- */}
      {latest.length ? (
        <section className="py-6 pb-10">
          <SectionTitle kicker="Fresh" title="新片速递" href="/movies?sort=latest" />
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-9">
            {latest.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="serif text-3xl sm:text-4xl font-bold">{n?.toLocaleString?.() ?? n}</div>
      <div className="kicker mt-1.5">{label}</div>
    </div>
  );
}
