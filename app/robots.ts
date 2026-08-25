import type { MetadataRoute } from "next"

const robots = (): MetadataRoute.Robots => ({
  rules: { userAgent: "*", allow: "/" },
  sitemap: "https://usz.reload.co.jp/sitemap.xml",
})

export default robots
