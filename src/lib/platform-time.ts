// The time zone the platform reckons dates in.
//
// Not the server's clock and not the viewer's. Anything the site presents as a
// calendar fact — which day a pledge landed on, which hour a campaign's first
// money came in — has to be reckoned somewhere, and "wherever the box happens
// to be configured" is not an answer that survives moving the box. Divinity
// Comics runs on Central time, so that is the reckoning zone.
//
// Storage stays UTC. This is a presentation and bucketing concern only.
export const PLATFORM_TIME_ZONE = "America/Chicago";

/**
 * The platform-local wall-clock bucket a moment falls in.
 *
 * `day`  -> "YYYY-MM-DD"
 * `hour` -> "YYYY-MM-DDTHH"
 *
 * These are wall-clock strings, deliberately carrying no zone suffix: they
 * sort and compare lexically, and callers walking a range can treat them as
 * UTC for the arithmetic without the result drifting, because every key in the
 * range was produced the same way.
 */
export function platformTimeKey(date: Date, granularity: "day" | "hour"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PLATFORM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  if (granularity === "day") return day;

  // hour12:false renders midnight as "24" under some ICU versions rather than
  // "00", which would sort after every real hour of the same day.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${day}T${hour}`;
}
