import type { MetadataRoute } from "next"

const sitemap = (): MetadataRoute.Sitemap => [
  { url: "https://usz.reload.co.jp", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
]

export default sitemap
