import Link from "next/link";
import Img from "./Img";
import { placeTypes } from "@/lib/categories";
import type { PlaceListItem } from "@/lib/mocation";

export default function PlaceCard({ place }: { place: PlaceListItem }) {
  const types = placeTypes(place.categories).slice(0, 2);
  const movie = place.movies?.[0];
  return (
    <Link href={`/place/${place.id}`} className="group block">
      <div className="zoomable aspect-[3/2] rounded-sm bg-paper-2 ring-1 ring-line/70">
        <Img src={place.coverPath} alt={place.cname} className="h-full w-full object-cover" />
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="serif text-[15px] font-semibold leading-snug group-hover:text-accent transition-colors line-clamp-1">
            {place.cname}
          </h3>
          {place.areaCname ? (
            <span className="text-[11px] text-faint shrink-0">{place.areaCname}</span>
          ) : null}
        </div>
        {types.length ? (
          <p className="mt-1 text-[11px] text-muted">{types.join(" · ")}</p>
        ) : null}
        {movie ? (
          <p className="mt-1 text-[11px] text-faint line-clamp-1">
            出现于 <span className="text-muted">《{movie.cname}》</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
