import { redirect } from "next/navigation";

// Analytics has been merged into the dashboard. Keep this route as a redirect
// so existing links and bookmarks still land somewhere sensible.
export default function StoreAnalyticsRedirect() {
  redirect("/store");
}
