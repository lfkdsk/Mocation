"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBox({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const k = q.trim();
    if (k) router.push(`/search?q=${encodeURIComponent(k)}`);
  }

  return (
    <form onSubmit={submit} className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索电影、取景地、城市…"
        aria-label="搜索"
        className={`peer w-full bg-transparent border-b border-line focus:border-accent outline-none transition-colors placeholder:text-faint ${
          compact ? "text-sm py-1.5 pr-7" : "py-2.5 pr-9 text-base"
        }`}
      />
      <button
        type="submit"
        aria-label="搜索"
        className="absolute right-0 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
