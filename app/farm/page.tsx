import FarmPage from "@/domain/farm/page";
import { getStaticGameData } from "@/shared/lib/data/server";

export default async function Page() {
  const data = await getStaticGameData();

  return <FarmPage initialData={data} />;
}
