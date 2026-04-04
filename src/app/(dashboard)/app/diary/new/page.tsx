import { DiaryForm } from "@/components/diary/diary-form";
import { yesterdayLocalDateString } from "@/lib/diary/dates";
import Link from "next/link";

export const metadata = {
  title: "新建睡眠日记",
};

export default async function NewDiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const defaultDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : yesterdayLocalDateString();

  return (
    <div>
      <div className="border-b border-zinc-200 bg-white px-4 py-3">
        <Link href="/app/diary" className="text-sm text-zinc-600 underline-offset-2 hover:underline">
          ← 返回列表
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">睡眠日记</h1>
        <p className="mt-1 text-xs text-zinc-500">约 1 分钟填完；保存后同日主记录会覆盖。</p>
      </div>
      <DiaryForm defaultEntryDate={defaultDate} />
    </div>
  );
}
