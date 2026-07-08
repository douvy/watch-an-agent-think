import type { MetadataRoute } from "next";
import { scenarioSets } from "@/data";

const BASE = "https://howagentsthink.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const runs = Object.values(scenarioSets)
    .flat()
    .map((s) => ({ url: `${BASE}/runs/${s.id}` }));
  return [{ url: BASE }, ...runs];
}
