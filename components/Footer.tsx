export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <div className="serif text-xl font-semibold text-ink">Mocation</div>
            <p className="mt-2 max-w-md leading-relaxed text-faint">
              在地图上发现电影与剧集的取景地。本站为学习研究用途的非官方浏览客户端，
              数据来自 mocation.cc 公开接口，版权归原作者所有。
            </p>
          </div>
          <div className="text-xs text-faint leading-relaxed">
            <p>Unofficial · For study only</p>
            <p className="mt-1">Built with Next.js · Deployed on Cloudflare Pages</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
