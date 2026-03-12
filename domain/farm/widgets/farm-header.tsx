import { Badge } from "@/shared/ui/badge";

interface FarmHeaderProps {
  dataVersion: string;
}

export function FarmHeader({ dataVersion }: FarmHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0d121c_0%,#101a2c_45%,#1d1227_100%)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(97,164,255,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,143,61,0.14),transparent_24%)] opacity-90" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/70">
            Essence Route Console
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            위험구역 파밍 추천
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-5 text-white/68">
            무기 Essence 조합과 옵션 확률업 티켓을 바탕으로, 지금 가장 효율 좋은
            위험구역을 빠르게 찾을 수 있게 구성했습니다.
          </p>
        </div>
        <Badge className="border-white/15 bg-white/8 px-3 py-1.5 text-white/80">
          데이터 v{dataVersion}
        </Badge>
      </div>
    </section>
  );
}
