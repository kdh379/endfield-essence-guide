import ScanPage from "@/domain/scan/page";
import { getStaticGameData } from "@/shared/lib/data/server";

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
