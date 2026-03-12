import type { Metadata } from "next";

import FarmPage from "@/domain/farm/page";
import { getStaticGameData } from "@/shared/lib/data/server";
import { siteName, siteUrl } from "@/shared/lib/site";

export const metadata: Metadata = {
  title: "엔드필드 옵션작 추천",
  description:
    "엔드필드 옵션작과 기질작 파밍 동선을 정리한 추천 페이지입니다. 원하는 무기나 옵션을 기준으로 파밍 구역과 유효 옵션 조합을 빠르게 찾을 수 있습니다.",
  keywords: [
    "엔드필드 옵션작",
    "엔드필드 옵션툴",
    "엔드필드 기질작",
    "엔드필드 파밍",
    "엔드필드 무기 옵션 추천",
  ],
  alternates: {
    canonical: "/farm",
  },
  openGraph: {
    url: `${siteUrl}/farm`,
    siteName,
    title: "엔드필드 옵션작 추천 | 무기·옵션 파밍 가이드",
    description:
      "무기, 옵션, 구역 기준으로 엔드필드 옵션작 파밍 루트를 찾을 수 있는 가이드 페이지입니다.",
  },
  twitter: {
    card: "summary",
    title: "엔드필드 옵션작 추천 | 무기·옵션 파밍 가이드",
    description: "엔드필드 옵션작과 기질작 파밍 루트를 빠르게 찾는 추천 툴",
  },
};

export default async function Page() {
  const data = await getStaticGameData();

  return <FarmPage initialData={data} />;
}
