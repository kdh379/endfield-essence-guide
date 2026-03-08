"use client";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type { Option, ScannedTraitLine } from "@/shared/lib/data/schemas";

interface TraitEditorProps {
  lines: ScannedTraitLine[];
  options: Option[];
  onChange: (next: ScannedTraitLine[]) => void;
  onSaveCorrection: (line: ScannedTraitLine) => void;
}

export function TraitEditor({
  lines,
  options,
  onChange,
  onSaveCorrection,
}: TraitEditorProps) {
  const selectItems = options.map((option) => ({
    label: `${option.nameKo} (${option.category})`,
    value: option.id,
  }));

  const updateLine = (index: number, patch: Partial<ScannedTraitLine>) => {
    const next = lines.map((line, idx) =>
      idx === index ? { ...line, ...patch, userCorrected: true } : line,
    );
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div key={line.lineNo} className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">라인 {line.lineNo}</p>
            <p className="text-xs text-muted-foreground">
              confidence: {(line.confidence * 100).toFixed(1)}%
            </p>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            <Input
              value={line.rawText}
              onChange={(event) =>
                updateLine(index, {
                  rawText: event.target.value,
                  normalizedText: event.target.value,
                })
              }
              placeholder="OCR 원문"
            />
            <Select
              items={selectItems}
              value={line.optionId ?? null}
              onValueChange={(value) =>
                updateLine(index, {
                  optionId: value ?? undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="옵션 선택" />
              </SelectTrigger>
              <SelectContent>
                {selectItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onSaveCorrection(lines[index])}
            >
              교정 저장
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
