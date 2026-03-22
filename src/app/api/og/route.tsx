import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
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
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
          position: "relative",
        }}
      >
        {/* Gradient accent bar at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
            display: "flex",
          }}
        />

        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            left: "-80px",
            width: "350px",
            height: "350px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
          }}
        >
          {/* Logo text */}
          <div
            style={{
              fontSize: "72px",
              fontWeight: 800,
              background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1.1,
              display: "flex",
            }}
          >
            IndieCrowdfund
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "28px",
              color: "#d1d5db",
              fontWeight: 400,
              textAlign: "center",
              maxWidth: "800px",
              lineHeight: 1.4,
              display: "flex",
            }}
          >
            The #1 Kickstarter Alternative | Crowdfunding for Creators
          </div>

          {/* Feature pills */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              marginTop: "16px",
            }}
          >
            <div
              style={{
                padding: "10px 24px",
                borderRadius: "999px",
                border: "1px solid rgba(16,185,129,0.4)",
                color: "#10b981",
                fontSize: "18px",
                fontWeight: 500,
                display: "flex",
              }}
            >
              Lower Fees
            </div>
            <div
              style={{
                padding: "10px 24px",
                borderRadius: "999px",
                border: "1px solid rgba(6,182,212,0.4)",
                color: "#06b6d4",
                fontSize: "18px",
                fontWeight: 500,
                display: "flex",
              }}
            >
              Better Tools
            </div>
            <div
              style={{
                padding: "10px 24px",
                borderRadius: "999px",
                border: "1px solid rgba(16,185,129,0.4)",
                color: "#10b981",
                fontSize: "18px",
                fontWeight: 500,
                display: "flex",
              }}
            >
              Creator Focused
            </div>
          </div>
        </div>

        {/* URL at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            fontSize: "20px",
            color: "#6b7280",
            fontWeight: 400,
            display: "flex",
          }}
        >
          www.indiecrowdfund.com
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
