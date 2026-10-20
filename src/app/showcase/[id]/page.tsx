import type { Metadata } from "next";
import { ShowcasePage } from "@/components/pages/showcase-page";
import { getShowcase } from "@/lib/data";

export const dynamic = "force-dynamic";

type ShowcaseRoute = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: ShowcaseRoute): Promise<Metadata> {
  const { id } = await params;
  const showcase = /^\d+$/.test(id) ? getShowcase(Number(id)) : null;
  if (!showcase) {
    return { title: "Showcase", description: "Cotton & Clay pieces for shop owners." };
  }
  return {
    title: showcase.title,
    description: showcase.description || `${showcase.title} from Cotton & Clay, with variants and retail prices.`,
  };
}

export default function Page() {
  return <ShowcasePage />;
}
