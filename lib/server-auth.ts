import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const serverAuthConfigError =
  !supabaseUrl || !serviceRoleKey
    ? "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment."
    : null;

export const admin = createClient(
  supabaseUrl || "http://127.0.0.1:54321",
  serviceRoleKey || "invalid-service-role-key",
  {
  auth: { persistSession: false }
});

const SESSION_COOKIE = "cordless_session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashedBuffer = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(hashedBuffer, candidate);
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function createSession(userId: string) {
  if (serverAuthConfigError) throw new Error(serverAuthConfigError);
  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256(token);

  await admin.from("app_sessions").insert({ user_id: userId, token_hash: tokenHash });

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSession() {
  if (serverAuthConfigError) return;
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await admin.from("app_sessions").delete().eq("token_hash", sha256(token));
  }

  cookies().delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  if (serverAuthConfigError) return null;
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data: session } = await admin
    .from("app_sessions")
    .select("id, user_id, app_users(id, username)")
    .eq("token_hash", sha256(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!session) return null;

  const user = Array.isArray(session.app_users) ? session.app_users[0] : session.app_users;
  if (!user) return null;

  return { id: user.id as string, username: user.username as string };
}
