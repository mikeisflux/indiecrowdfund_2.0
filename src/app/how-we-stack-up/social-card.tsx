import { ImageResponse } from "next/og";

// Shared renderer for the /how-we-stack-up social card. This is a plain module
// (NOT a route-convention file), so both opengraph-image.tsx and
// twitter-image.tsx can import it. Each of those route files declares its own
// runtime/alt/size/contentType as inline literals — Turbopack must be able to
// statically parse those, so they can't be imported or re-exported.
export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 };
export const SOCIAL_CARD_ALT =
  "How IndieCrowdfund stacks up against Kickstarter, Indiegogo, and Fund My Comic";

// Keep in sync with the headline scoreboard on the page. Backmebro's column is
// now fully assessed (from its live site + Terms of Service): 10 of our
// features present.
const SCORES = [
  { name: "IndieCrowdfund", score: "29", highlight: true },
  { name: "Indiegogo", score: "13", highlight: false },
  { name: "Kickstarter", score: "12", highlight: false },
  { name: "Fund My Comic", score: "5", highlight: false },
  { name: "Backmebro", score: "8", highlight: false },
];

export function renderSocialCard() {
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
          backgroundColor: "#0a0a0a",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top gradient accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "8px",
            background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
            display: "flex",
          }}
        />
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: "420px",
            height: "420px",
            borderRadius: "210px",
            opacity: 0.08,
            backgroundColor: "#10b981",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-140px",
            left: "-90px",
            width: "380px",
            height: "380px",
            borderRadius: "190px",
            opacity: 0.06,
            backgroundColor: "#06b6d4",
            display: "flex",
          }}
        />

        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              display: "flex",
            }}
          />
          <div style={{ fontSize: "30px", fontWeight: 700, color: "#e5e7eb", display: "flex" }}>
            IndieCrowdfund
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", fontSize: "82px", fontWeight: 800, lineHeight: 1.05 }}>
          <span style={{ color: "#ffffff" }}>How We&nbsp;</span>
          <span style={{ color: "#10b981" }}>Stack Up</span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "26px",
            color: "#9ca3af",
            marginTop: "16px",
            marginBottom: "20px",
          }}
        >
          Features included, compared across the field
        </div>

        {/* Legend — matches the page: green check = included, red cross = not.
            Drawn as inline SVG (not ✓/✕ glyphs) so next/og never tries to fetch
            a remote emoji font — that download is blocked on the server and was
            crashing OG rendering. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "28px",
            marginBottom: "40px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <div style={{ display: "flex", fontSize: "20px", color: "#9ca3af" }}>Included</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
            <div style={{ display: "flex", fontSize: "20px", color: "#9ca3af" }}>Not available</div>
          </div>
        </div>

        {/* Scoreboard */}
        <div style={{ display: "flex", gap: "16px" }}>
          {SCORES.map((s) => (
            <div
              key={s.name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "206px",
                height: "150px",
                borderRadius: "18px",
                border: s.highlight ? "2px solid #10b981" : "1px solid #27272a",
                backgroundColor: s.highlight ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "54px",
                  fontWeight: 800,
                  color: s.highlight ? "#10b981" : s.score === "?" ? "#6b7280" : "#e5e7eb",
                }}
              >
                {s.score}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "19px",
                  fontWeight: 600,
                  color: s.highlight ? "#a7f3d0" : "#9ca3af",
                  marginTop: "8px",
                }}
              >
                {s.name}
              </div>
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            fontSize: "20px",
            color: "#6b7280",
            display: "flex",
          }}
        >
          indiecrowdfund.com/how-we-stack-up
        </div>
      </div>
    ),
    { ...SOCIAL_CARD_SIZE }
  );
}
