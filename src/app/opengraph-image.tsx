import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Lia — Transforme n'importe quel sujet en formation sur mesure";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#06070f",
          backgroundImage:
            "radial-gradient(circle at 25% 15%, rgba(139,92,246,0.35), transparent 55%), radial-gradient(circle at 80% 70%, rgba(76,124,243,0.3), transparent 55%)",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #4c7cf3 0%, #8b5cf6 100%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
              <div style={{ width: 11, height: 20, borderRadius: 4, background: "rgba(255,255,255,0.95)" }} />
              <div style={{ width: 11, height: 34, borderRadius: 4, background: "rgba(255,255,255,0.95)" }} />
              <div style={{ width: 11, height: 50, borderRadius: 4, background: "white" }} />
            </div>
          </div>
          <span style={{ fontSize: 56, fontWeight: 700, color: "white" }}>Lia</span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 48,
            maxWidth: 920,
            textAlign: "center",
            fontSize: 44,
            fontWeight: 600,
            lineHeight: 1.2,
            color: "white",
            letterSpacing: -1,
          }}
        >
          Transforme n&apos;importe quel sujet en formation interactive
        </div>

        <div style={{ display: "flex", marginTop: 28, fontSize: 26, color: "#9797ad" }}>
          Chapitres progressifs · Exemples concrets · Quiz
        </div>
      </div>
    ),
    { ...size },
  );
}
