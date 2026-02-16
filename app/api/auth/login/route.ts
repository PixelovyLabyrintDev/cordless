import { NextResponse } from "next/server";
import { admin, createSession, verifyPassword } from "@/lib/server-auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();
  const normalizedUsername = String(username ?? "").trim().toLowerCase();
  const rawPassword = String(password ?? "").trim();

  const { data: user } = await admin
    .from("app_users")
    .select("id, username, password_hash")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (!user || !verifyPassword(rawPassword, user.password_hash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, username: user.username } });
}
