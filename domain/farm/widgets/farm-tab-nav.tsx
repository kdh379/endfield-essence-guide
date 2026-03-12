import {
  tabLabel,
  zoneAccent,
  type FarmTabKey,
} from "@/domain/farm/widgets/farm-theme";

interface FarmTabNavProps {
  tab: FarmTabKey;
  onChange: (nextTab: FarmTabKey) => void;
}

export function FarmTabNav({ tab, onChange }: FarmTabNavProps) {
  return (
    <section className="grid gap-2 rounded-[22px] border border-white/10 bg-[#0b1017]/92 p-2 md:grid-cols-3">
      {(["weapon", "option", "zone"] as FarmTabKey[]).map((tabKey, index) => (
        <button
          key={tabKey}
          type="button"
          onClick={() => onChange(tabKey)}
          className={`rounded-[18px] border px-4 py-3 text-left transition-all duration-200 ${
            tab === tabKey
              ? `bg-linear-to-br ${zoneAccent(index)} border-white/20 shadow-[0_16px_28px_rgba(0,0,0,0.22)]`
              : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/6"
          }`}
        >
          <p className="text-xs font-medium text-white/50">탐색 모드</p>
          <p className="mt-1 text-base font-semibold text-white">
            {tabLabel(tabKey)}
          </p>
        </button>
      ))}
    </section>
  );
}
