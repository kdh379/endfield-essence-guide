import type { Option } from "@/shared/lib/data/schemas";

import { optionTone } from "@/domain/farm/widgets/farm-theme";

interface OptionBadgeListProps {
  optionIds: string[];
  optionsById: Map<string, Option>;
  className?: string;
}

export function OptionBadgeList({
  optionIds,
  optionsById,
  className = "mt-2 flex flex-wrap gap-1.5",
}: OptionBadgeListProps) {
  return (
    <div className={className}>
      {optionIds.map((optionId) => {
        const option = optionsById.get(optionId);
        if (!option) return null;

        return (
          <span
            key={optionId}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${optionTone(option.category, true)}`}
          >
            {option.nameKo}
          </span>
        );
      })}
    </div>
  );
}
