"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiMenu4Line, RiPulseLine } from "@remixicon/react";
import dayjs from "dayjs";

import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { Badge } from "@/shared/ui/badge";
import { getManifest } from "@/shared/lib/data/server";

const NAV_ITEMS = [
  { href: "/match", label: "기질 매칭" },
  { href: "/farming", label: "파밍 추천" },
];

function NavLinks({
  pathname,
  mobile = false,
}: {
  pathname: string;
  mobile?: boolean;
}) {
  return (
    <div
      className={mobile ? "grid gap-2" : "hidden items-center gap-2 md:flex"}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-primary/50 bg-primary/20 text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function GlobalNav({
  dataVersion,
  updatedAt,
}: {
  dataVersion: string;
  updatedAt: string;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/match" className="flex items-center gap-2">
          <span className="rounded-md border border-primary/50 bg-primary/15 p-1.5 text-primary">
            <RiPulseLine size={16} />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Endfield Tool
            </p>
            <p className="font-semibold">기질 가이드 콘솔</p>
          </div>
        </Link>

        <NavLinks pathname={pathname} />

        <div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant="secondary">데이터: v{dataVersion}</Badge>
            <Badge variant="secondary">
              업데이트: {dayjs(updatedAt).format("YYYY-MM-DD")}
            </Badge>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="md:hidden">
                <RiMenu4Line />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="border-l-border/70 bg-background/95"
            >
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <NavLinks pathname={pathname} mobile />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
