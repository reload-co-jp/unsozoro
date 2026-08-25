import { ImageResponse } from "next/og"

export const dynamic = "force-static"

const size = { width: 512, height: 512 }

export const GET = () =>
  new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#d74b2a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 300, fontWeight: 700 }}>
        U
      </div>
    ),
    size,
  )
