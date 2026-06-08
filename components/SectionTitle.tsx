import Link from "next/link";

export default function SectionTitle({
  kicker,
  title,
  href,
  more = "查看全部",
}: {
  kicker?: string;
  title: string;
  href?: string;
  more?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        {kicker ? <div className="kicker mb-2">{kicker}</div> : null}
        <h2 className="serif text-2xl sm:text-[28px] font-bold tracking-tight">{title}</h2>
      </div>
      {href ? (
        <Link href={href} className="text-sm text-muted hover:text-accent ul-anim pb-0.5 shrink-0">
          {more} →
        </Link>
      ) : null}
    </div>
  );
}
