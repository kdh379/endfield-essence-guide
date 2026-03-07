import { HistoryList } from "@/domain/history/widgets/history-list";

export default function HistoryPage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-4 p-4 pb-10 md:p-6">
      <header className="hud-panel p-5">
        <p className="hud-title">History Log</p>
        <h1 className="text-2xl font-semibold">Scan History Console</h1>
        <p className="text-sm text-muted-foreground">
          Review saved scans, lock status, and matching summaries in one place.
        </p>
      </header>
      <HistoryList />
    </main>
  );
}
