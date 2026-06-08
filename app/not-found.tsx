import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-32 text-center">
      <div className="serif text-7xl font-bold text-accent">404</div>
      <h1 className="serif text-2xl font-semibold mt-4">没有找到这一帧</h1>
      <p className="text-muted mt-3">这个页面可能已下线，或链接有误。</p>
      <Link
        href="/"
        className="inline-block mt-8 bg-ink text-paper text-sm px-5 py-2.5 rounded-sm hover:bg-accent transition-colors"
      >
        返回首页
      </Link>
    </div>
  );
}
