import { redirect } from "next/navigation";

// Compatibility redirect for any stale bookmarks / external links that
// still point at the old /dashboard/indiekit-v2 URL. The v1/v2 split
// was consolidated in 79b93054 — everything now lives at
// /dashboard/indiekit. Drop this file once analytics confirm zero
// traffic on this path.
export default function IndieKitV2RedirectPage() {
  redirect("/dashboard/indiekit");
}
