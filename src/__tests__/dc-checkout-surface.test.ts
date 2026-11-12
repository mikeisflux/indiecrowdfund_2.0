import { describe, it, expect } from "vitest";
import { dcCheckoutSurfaceFor } from "@/lib/payments/divinitycoin/checkout-surface";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36";
const ANDROID_TWITTER_WEBVIEW = "Mozilla/5.0 (Linux; Android 17; SM-S937U Build/CP2A.260605.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/156.0.8078.47 Mobile Safari/537.36 TwitterAndroid/12.41.0-prod.01";
const WINDOWS_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";
const FB_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/430.0.0.0]";

describe("dcCheckoutSurfaceFor", () => {
  it("sends iOS and in-app browsers to the top-level page", () => {
    expect(dcCheckoutSurfaceFor(IPHONE)).toBe("redirect");
    expect(dcCheckoutSurfaceFor(FB_IOS)).toBe("redirect");
    expect(dcCheckoutSurfaceFor(IPAD_DESKTOP, 5)).toBe("redirect");
    expect(dcCheckoutSurfaceFor(ANDROID_TWITTER_WEBVIEW)).toBe("redirect");
  });
  it("keeps the iframe for desktop and Android Chrome", () => {
    expect(dcCheckoutSurfaceFor(WINDOWS_CHROME)).toBe("embed");
    expect(dcCheckoutSurfaceFor(IPAD_DESKTOP, 0)).toBe("embed");
    expect(dcCheckoutSurfaceFor(ANDROID_CHROME)).toBe("embed");
    expect(dcCheckoutSurfaceFor(null)).toBe("embed");
  });
});
