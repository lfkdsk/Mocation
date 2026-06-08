import PlaceCard from "@/components/PlaceCard";
import { getPlacesHot } from "@/lib/mocation";

export const revalidate = 3600;
export const metadata = { title: "取景地" };

export default async function PlacesPage() {
  const hot = await getPlacesHot();

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="mb-12">
        <div className="kicker mb-3">On Location</div>
        <h1 className="serif text-4xl sm:text-5xl font-bold tracking-tight">取景地</h1>
        <p className="mt-3 text-muted text-sm">
          共 {hot.total?.toLocaleString?.() ?? hot.places.length} 处 · 热门取景地
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
        {hot.places.map((p) => (
          <PlaceCard key={p.id} place={p} />
        ))}
      </div>
    </div>
  );
}
