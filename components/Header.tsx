import Link from "next/link";
import SearchBox from "./SearchBox";

const NAV = [
  { href: "/movies", label: "影视" },
  { href: "/places", label: "取景地" },
  { href: "/explore", label: "地图" },
  { href: "/search", label: "搜索" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md border-b border-line">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex items-center gap-6 h-16">
          <Link href="/" className="shrink-0 group">
            <span className="serif text-2xl font-bold tracking-tight">Mocation</span>
            <span className="ml-2 align-middle text-[10px] tracking-[0.25em] text-faint uppercase hidden sm:inline">
              取景地
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 ml-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm text-muted hover:text-ink ul-anim pb-0.5"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />
          <div className="w-44 sm:w-64">
            <SearchBox compact />
          </div>
        </div>
      </div>
    </header>
  );
}
