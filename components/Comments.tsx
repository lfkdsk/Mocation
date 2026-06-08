import Img from "./Img";
import { getComments } from "@/lib/mocation";

export default async function Comments({ type, id }: { type: string; id: number | string }) {
  let data: { total: number; list: { id: number; content: string; userName?: string; userAvatar?: string; createTime?: string }[] } | null = null;
  try {
    data = await getComments(type, id);
  } catch {
    return null;
  }
  if (!data || !data.total || !data.list?.length) return null;

  return (
    <section className="mt-16">
      <h2 className="serif text-2xl font-bold mb-6">
        热门评论 <span className="text-faint text-base font-normal">({data.total})</span>
      </h2>
      <ul className="space-y-6">
        {data.list.slice(0, 12).map((c) => (
          <li key={c.id} className="flex gap-3.5">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-paper-2 shrink-0 ring-1 ring-line">
              {c.userAvatar ? (
                <Img src={c.userAvatar} alt={c.userName || ""} className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{c.userName || "影迷"}</div>
              <p className="text-sm text-muted mt-1 leading-relaxed whitespace-pre-line">{c.content}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
