import { getSleepDiaryByDate } from "@/app/actions/diary";
import { DiaryForm } from "@/components/diary/diary-form";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return { title: `编辑 ${date}` };
}

export default async function EditDiaryPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  const row = await getSleepDiaryByDate(date);
  if (!row) {
    redirect(`/app/diary/new?date=${encodeURIComponent(date)}`);
  }

  return (
    <div>
      <div className="border-b border-zinc-200 bg-white px-4 py-3">
        <Link href="/app/diary" className="text-sm text-zinc-600 underline-offset-2 hover:underline">
          ← 返回列表
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">编辑 {date}</h1>
      </div>
      <DiaryForm defaultEntryDate={date} initialPayload={row.payload} />
    </div>
  );
}
