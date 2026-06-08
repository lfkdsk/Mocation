import MovieCard from "@/components/MovieCard";
import SectionTitle from "@/components/SectionTitle";
import { getMoviesHot, getMoviesLatest } from "@/lib/mocation";

export const runtime = "edge";
export const revalidate = 3600;
export const metadata = { title: "影视" };

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const latestFirst = sort === "latest";

  const [hot, latest] = await Promise.all([
    getMoviesHot(),
    getMoviesLatest().catch(() => ({ movies: [] })),
  ]);

  const Grid = ({ items }: { items: typeof hot.movies }) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-10">
      {items.map((m) => (
        <MovieCard key={m.id} movie={m} />
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="mb-12">
        <div className="kicker mb-3">Browse Films &amp; Series</div>
        <h1 className="serif text-4xl sm:text-5xl font-bold tracking-tight">
          {latestFirst ? "新片速递" : "影视作品"}
        </h1>
        <p className="mt-3 text-muted text-sm">
          {latestFirst
            ? "最新收录的影视作品"
            : `共 ${hot.total?.toLocaleString?.() ?? hot.movies.length} 部 · 按热度排序`}
        </p>
      </header>

      {latestFirst ? (
        <>
          {latest.movies?.length ? <Grid items={latest.movies} /> : null}
          <section className="mt-20">
            <SectionTitle kicker="Now Trending" title="热门影视" />
            <Grid items={hot.movies} />
          </section>
        </>
      ) : (
        <>
          <Grid items={hot.movies} />
          {latest.movies?.length ? (
            <section className="mt-20" id="latest">
              <SectionTitle kicker="Fresh" title="新片速递" />
              <Grid items={latest.movies} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
