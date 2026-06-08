import Link from "next/link";
import Img from "@/components/Img";
import MovieCard from "@/components/MovieCard";
import PlaceCard from "@/components/PlaceCard";
import SearchBox from "@/components/SearchBox";
import { search } from "@/lib/mocation";

export const revalidate = 600;
export const metadata = { title: "搜索" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const keyword = (q || "").trim();

  const res = keyword ? await search(keyword).catch(() => null) : null;
  const total = res
    ? res.movies.length + res.places.length + res.persons.length + res.areas.length + res.articles.length
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="max-w-xl">
        <div className="kicker mb-3">Search</div>
        <h1 className="serif text-4xl font-bold tracking-tight mb-6">搜索</h1>
        <SearchBox />
        <p className="mt-3 text-xs text-faint">影视、取景地、城市、人物、文章 —— 全站检索。</p>
      </div>

      {!keyword ? (
        <p className="mt-12 text-muted text-sm">输入电影、剧集、取景地、城市或影人名称开始探索。</p>
      ) : total === 0 ? (
        <p className="mt-12 text-muted text-sm">没有找到与「{keyword}」相关的结果，换个关键词试试。</p>
      ) : (
        <div className="mt-12 space-y-16">
          <p className="text-sm text-faint">「{keyword}」找到 {total} 条结果</p>

          {res!.movies.length ? (
            <section>
              <h2 className="serif text-2xl font-bold mb-6">影视 · {res!.movies.length}</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-9">
                {res!.movies.map((m) => (
                  <MovieCard key={m.id} movie={m} />
                ))}
              </div>
            </section>
          ) : null}

          {res!.places.length ? (
            <section>
              <h2 className="serif text-2xl font-bold mb-6">取景地 · {res!.places.length}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-9">
                {res!.places.map((p) => (
                  <PlaceCard key={p.id} place={p} />
                ))}
              </div>
            </section>
          ) : null}

          {res!.persons.length ? (
            <section>
              <h2 className="serif text-2xl font-bold mb-6">影人 · {res!.persons.length}</h2>
              <div className="flex flex-wrap gap-x-8 gap-y-6">
                {res!.persons.map((p) => (
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

          {res!.areas.length ? (
            <section>
              <h2 className="serif text-2xl font-bold mb-6">地区 · {res!.areas.length}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-9">
                {res!.areas.map((a) => (
                  <Link key={a.id} href={`/area/${a.id}`} className="group block">
                    <div className="zoomable aspect-[3/2] rounded-sm bg-paper-2 ring-1 ring-line/70 overflow-hidden">
                      <Img src={a.coverPath} alt={a.cname} className="h-full w-full object-cover" />
                    </div>
                    <h3 className="serif text-[15px] font-semibold mt-2 group-hover:text-accent transition-colors line-clamp-1">
                      {a.cname}
                    </h3>
                    {a.ename ? <p className="serif italic text-xs text-faint">{a.ename}</p> : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {res!.articles.length ? (
            <section>
              <h2 className="serif text-2xl font-bold mb-6">文章 · {res!.articles.length}</h2>
              <div className="space-y-5">
                {res!.articles.map((a) => (
                  <div key={a.id} className="flex gap-4">
                    <div className="w-28 h-20 shrink-0 rounded-sm bg-paper-2 ring-1 ring-line/70 overflow-hidden">
                      <Img src={a.coverPath} alt={a.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="serif text-[15px] font-semibold leading-snug line-clamp-1">{a.title}</h3>
                      {a.subTitle ? <p className="text-xs text-muted mt-0.5 line-clamp-1">{a.subTitle}</p> : null}
                      {a.digest ? <p className="text-xs text-faint mt-1 line-clamp-2">{a.digest}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
