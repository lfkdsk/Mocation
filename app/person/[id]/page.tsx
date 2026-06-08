import Link from "next/link";
import { notFound } from "next/navigation";
import Img from "@/components/Img";
import MovieCard from "@/components/MovieCard";
import { countryName } from "@/lib/categories";
import { getPerson } from "@/lib/mocation";

export const revalidate = 43200;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { person } = await getPerson(id);
    return { title: person.cname, description: person.desc?.slice(0, 120) };
  } catch {
    return { title: "影人" };
  }
}

function birthday(n?: number | null): string | null {
  if (!n) return null;
  const s = String(n);
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let person;
  try {
    ({ person } = await getPerson(id));
  } catch {
    notFound();
  }

  const meta = [
    countryName(person.countryId, person.countryCname),
    person.sex === 1 ? "男" : person.sex === 2 ? "女" : null,
    birthday(person.birthday),
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/search" className="text-sm text-muted hover:text-accent ul-anim pb-0.5">
        ← 搜索
      </Link>

      <section className="mt-6 grid md:grid-cols-[220px_1fr] gap-8 md:gap-12">
        <div className="w-40 md:w-full max-w-[220px]">
          <div className="aspect-[3/4] rounded-full md:rounded-sm overflow-hidden bg-paper-2 ring-1 ring-line">
            <Img src={person.coverPath} alt={person.cname} className="h-full w-full object-cover" />
          </div>
        </div>
        <div>
          <div className="label mb-3">影人 Filmmaker</div>
          <h1 className="serif text-4xl sm:text-5xl font-bold tracking-tight">{person.cname}</h1>
          {person.ename ? <p className="serif italic text-xl text-muted mt-2">{person.ename}</p> : null}
          {meta.length ? <p className="mt-4 text-sm text-muted tracking-wide">{meta.join("  ·  ")}</p> : null}
          {person.desc ? (
            <p className="mt-6 text-[15px] leading-loose text-ink/90 max-w-2xl whitespace-pre-line">{person.desc}</p>
          ) : null}
        </div>
      </section>

      {person.movies?.length ? (
        <section className="mt-16">
          <h2 className="serif text-2xl font-bold mb-6">
            参演作品 <span className="text-faint text-base font-normal">({person.movies.length})</span>
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-9">
            {person.movies.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
