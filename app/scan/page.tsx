import type { Metadata } from "next";

import ScanPage from "@/domain/scan/page";
import { getStaticGameData } from "@/shared/lib/data/server";
import { siteName, siteUrl } from "@/shared/lib/site";

export const metadata: Metadata = {
  title: "엔드필드 기질 스캐너",
  description:
    "엔드필드 기질 스캐너로 옵션 3줄을 OCR 인식하고, 기질작 결과에 맞는 유효 무기 후보를 바로 확인하세요. 엔드필드 옵션작과 기질작 확인에 최적화된 스캔 툴입니다.",
  keywords: [
    "엔드필드 기질 스캐너",
    "엔드필드 기질작",
    "엔드필드 옵션작",
    "엔드필드 옵션툴",
    "엔드필드 OCR",
  ],
  alternates: {
    canonical: "/scan",
  },
  openGraph: {
    url: `${siteUrl}/scan`,
    siteName,
    title: "엔드필드 기질 스캐너 | 옵션 3줄 OCR 분석 툴",
    description:
      "화면 공유 기반 OCR로 엔드필드 기질작 옵션 3줄을 스캔하고 유효 무기를 추천하는 웹 도구입니다.",
  },
  twitter: {
    card: "summary",
    title: "엔드필드 기질 스캐너 | 옵션 3줄 OCR 분석 툴",
    description:
      "엔드필드 기질작과 옵션작 확인을 빠르게 도와주는 OCR 스캔 도구",
  },
};

export default async function Page() {
  const data = await getStaticGameData();

  return (
    <ScanPage
      initialData={{
        dataVersion: data.dataVersion,
        options: data.options,
        weapons: data.weapons,
      }}
    />
  );
}
