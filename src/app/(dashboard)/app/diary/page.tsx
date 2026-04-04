import { listSleepDiaryEntries } from "@/app/actions/diary";
import {
  DiaryShell,
  type DiaryView,
} from "@/components/diary/diary-shell";

export const metadata = {
  title: "睡眠日记",
};

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const view: DiaryView = sp.view === "chart" ? "chart" : "list";
  const entries = await listSleepDiaryEntries(120);

  return <DiaryShell entries={entries} view={view} />;
}
