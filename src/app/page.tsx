import { redirect } from "next/navigation";
import { getSessionProfile, homeForRole } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  redirect(homeForRole(session.profile.role));
}
