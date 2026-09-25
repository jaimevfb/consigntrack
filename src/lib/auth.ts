import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

export interface SessionProfile {
  authUserId: string;
  email: string | null;
  profile: AppUser;
}

/**
 * Resolve the current user's app_users profile (role + scope).
 * Returns null when unauthenticated or the profile row is missing.
 * Wrapped in React cache() so the layout + page + any helper share a single
 * auth.getUser + profile fetch per request instead of repeating them.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) return null;
  return { authUserId: user.id, email: user.email ?? null, profile: profile as AppUser };
});

/** Require a signed-in user with a profile, else redirect to /login. */
export async function requireProfile(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  return session;
}

/** The home route for a given role. */
export function homeForRole(role: AppUser["role"]): string {
  switch (role) {
    case "consignor":
      return "/consignor";
    case "store_manager":
    case "store_staff":
      return "/store";
    case "admin":
      return "/admin";
    default:
      return "/login";
  }
}
