import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// OG card = the shareable moment frozen: scenario 2 at ~29s, right after
// plan A dies and plan B appears. Rendered with the same tokens as the site.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Watch how an AI agent thinks — plan A dies, plan B replaces it";

const planA = [
  "Check the server logs",
  "Diagnose the failure",
  "Apply the fix",
  "Verify 200s",
];
const planB = [
  "Reproduce the failure directly",
  "Trace the request path",
  "Fix the real cause",
  "Verify 200s",
];

function Corner({ style }: { style: React.CSSProperties }) {
  return (
    <span
      style={{
        position: "absolute",
        color: "#4d525e",
        fontSize: 22,
        lineHeight: 1,
        ...style,
      }}
    >
      +
    </span>
  );
}

export default async function OpengraphImage() {
  const [regular, medium] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/JetBrainsMono-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/JetBrainsMono-Medium.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#000",
          padding: 28,
          fontFamily: "JetBrains Mono",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            border: "1px solid #474b56",
            padding: "48px 56px",
          }}
        >
          <Corner style={{ top: -12, left: -7 }} />
          <Corner style={{ top: -12, right: -7 }} />
          <Corner style={{ bottom: -12, left: -7 }} />
          <Corner style={{ bottom: -12, right: -7 }} />

          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="44" height="44" viewBox="0 0 16 16">
              <g fill="#3a3f4a">
                <rect x="3" y="1" width="1" height="1" />
                <rect x="3" y="2" width="2" height="1" />
                <rect x="3" y="3" width="3" height="1" />
                <rect x="12" y="1" width="1" height="1" />
                <rect x="11" y="2" width="2" height="1" />
                <rect x="10" y="3" width="3" height="1" />
                <rect x="2" y="4" width="12" height="8" />
                <rect x="0" y="6" width="2" height="3" />
                <rect x="14" y="6" width="2" height="3" />
                <rect x="2" y="12" width="2" height="1" />
                <rect x="5" y="12" width="2" height="1" />
                <rect x="9" y="12" width="2" height="1" />
                <rect x="12" y="12" width="2" height="1" />
              </g>
              <rect x="3" y="5" width="10" height="4" fill="#555b68" />
              <rect x="5" y="6" width="2" height="2" fill="#84f0a1" />
              <rect x="9" y="6" width="2" height="2" fill="#84f0a1" />
            </svg>
            <span
              style={{ fontSize: 18, letterSpacing: 3, color: "#636a76" }}
            >
              INTERACTIVE EXPLAINER
            </span>
          </div>

          <div
            style={{
              marginTop: 22,
              fontSize: 54,
              fontWeight: 500,
              color: "#d9dce0",
            }}
          >
            Watch how an AI agent thinks
          </div>

          {/* the moment: plan A dead, plan B fresh */}
          <div style={{ display: "flex", gap: 90, marginTop: 52, flex: 1 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                opacity: 0.55,
              }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                <span style={{ fontSize: 16, letterSpacing: 2, color: "#636a76" }}>
                  PLAN A
                </span>
                <span style={{ fontSize: 17, color: "#d45a2b" }}>
                  † built on a misread symptom
                </span>
              </div>
              {planA.map((s, i) => (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    gap: 12,
                    fontSize: 20,
                    color: "#636a76",
                    textDecoration: i < 3 ? "line-through" : "none",
                  }}
                >
                  <span>{i < 3 ? "✓" : "·"}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 16, letterSpacing: 2, color: "#636a76" }}>
                PLAN B
              </span>
              {planB.map((s, i) => (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    gap: 12,
                    fontSize: 20,
                    color: i === 0 ? "#d9dce0" : "#636a76",
                  }}
                >
                  <span style={{ color: i === 0 ? "#84f0a1" : "#636a76" }}>
                    {i === 0 ? "▸" : "·"}
                  </span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* scrubber */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "flex",
                position: "relative",
                height: 2,
                background: "#474b56",
              }}
            >
              <div style={{ width: "46.4%", height: 2, background: "#84f0a1" }} />
              <div
                style={{
                  position: "absolute",
                  left: "46.4%",
                  top: -7,
                  width: 2,
                  height: 16,
                  background: "#d9dce0",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 17,
                color: "#7b7e8a",
              }}
            >
              <span>the recovery — plan dies at 29.0s</span>
              <span>29.0 / 63s</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "JetBrains Mono", data: regular, weight: 400 },
        { name: "JetBrains Mono", data: medium, weight: 500 },
      ],
    },
  );
}
