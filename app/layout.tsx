import "./reset.css"

const title = "Unsozoro | 歩いて見つける散歩ゲーム"
const description = "街を歩いて、まだ見ぬ場所を開拓する位置情報ゲーム"

export const metadata = {
  metadataBase: new URL("https://usz.reload.co.jp"),
  title,
  description,
  keywords: ["散歩", "散策", "位置情報ゲーム", "街歩き", "そぞろ歩き", "Unsozoro"],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", locale: "ja_JP", url: "/", siteName: "Unsozoro", title, description },
  twitter: { card: "summary_large_image", title, description },
}

export const viewport = { themeColor: "#21282f" }

const RootLayout = ({ children }: { children: React.ReactNode }) => <html lang="ja"><body>{children}</body></html>
export default RootLayout
