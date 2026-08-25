import type { MetadataRoute } from "next"

export const dynamic = "force-static"

const sitemap = (): MetadataRoute.Sitemap => [
  { url: "https://usz.reload.co.jp", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
]

export default sitemap
