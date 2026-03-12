import type { Metadata } from "next";

export { default } from "@/domain/history/page";

export const metadata: Metadata = {
  title: "스캔 기록",
  robots: {
    index: false,
    follow: false,
  },
};
