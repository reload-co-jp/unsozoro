import { ImageResponse } from "next/og"

export const dynamic = "force-static"
export const size = { width: 64, height: 64 }
export const contentType = "image/png"

const Icon = () =>
  new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#d74b2a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 38, fontWeight: 700 }}>
        U
      </div>
    ),
    size,
  )

export default Icon
