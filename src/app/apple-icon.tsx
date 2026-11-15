import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4c7cf3 0%, #8b5cf6 100%)",
          borderRadius: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <div style={{ width: 20, height: 38, borderRadius: 7, background: "rgba(255,255,255,0.95)" }} />
          <div style={{ width: 20, height: 64, borderRadius: 7, background: "rgba(255,255,255,0.95)" }} />
          <div style={{ width: 20, height: 92, borderRadius: 7, background: "white" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
