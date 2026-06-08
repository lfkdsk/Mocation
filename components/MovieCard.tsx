import Link from "next/link";
import Img from "./Img";
import { movieGenres, countryName } from "@/lib/categories";
import type { MovieListItem } from "@/lib/mocation";

export default function MovieCard({ movie }: { movie: MovieListItem }) {
  const genres = movieGenres(movie.categories).slice(0, 2);
  const country = countryName(movie.countryId, movie.countryCname);
  return (
    <Link href={`/movie/${movie.id}`} className="group block">
      <div className="zoomable aspect-[2/3] rounded-sm bg-paper-2 ring-1 ring-line/70">
        <Img src={movie.coverPath} alt={movie.cname} className="h-full w-full object-cover" />
      </div>
      <div className="mt-3">
        <h3 className="serif text-[15px] font-semibold leading-snug group-hover:text-accent transition-colors line-clamp-1">
          {movie.cname}
          {movie.series ? <span className="ml-1 text-[10px] align-top text-accent">剧集</span> : null}
        </h3>
        {movie.ename ? (
          <p className="serif italic text-xs text-faint mt-0.5 line-clamp-1">{movie.ename}</p>
        ) : null}
        <p className="mt-1.5 text-[11px] text-muted tracking-wide">
          {[movie.year || null, country, genres.join(" / ") || null].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
