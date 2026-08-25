import type { MetadataRoute } from "next"

export const dynamic = "force-static"

const manifest = (): MetadataRoute.Manifest => ({
  name: "Unsozoro | 歩いて見つける散歩ゲーム",
  short_name: "Unsozoro",
  description: "街を歩いて、まだ見ぬ場所を開拓する位置情報ゲーム",
  start_url: "/",
  display: "standalone",
  background_color: "#21282f",
  theme_color: "#21282f",
  icons: [
    { src: "/pwa-icon-192", sizes: "192x192", type: "image/png" },
    { src: "/pwa-icon-512", sizes: "512x512", type: "image/png" },
    { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
})

export default manifest
