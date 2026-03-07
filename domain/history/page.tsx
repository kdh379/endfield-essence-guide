import { HistoryList } from "@/domain/history/widgets/history-list";

export default function HistoryPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-4 p-4 md:p-6">
      <header className="rounded-xl border bg-card p-4">
        <div>
          <h1 className="text-xl font-semibold">스캔 기록</h1>
          <p className="text-sm text-muted-foreground">
            자동 인식으로 저장한 기질/잠금 기록입니다.
          </p>
        </div>
      </header>
      <HistoryList />
    </main>
  );
}



