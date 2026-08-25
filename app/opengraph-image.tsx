import { ImageResponse } from "next/og"

export const dynamic = "force-static"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const OpengraphImage = () =>
  new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#21282f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
        <div style={{ display: "flex", width: 108, height: 108, borderRadius: "50%", background: "#d74b2a", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 64, fontWeight: 700 }}>U</div>
        <div style={{ display: "flex", color: "#fff", fontSize: 64, fontWeight: 700 }}>Unsozoro</div>
        <div style={{ display: "flex", color: "#c7cdd1", fontSize: 30 }}>歩いて見つける散歩ゲーム</div>
      </div>
    ),
    size,
  )

export default OpengraphImage
