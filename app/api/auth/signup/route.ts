import { NextResponse } from "next/server";
import { admin, createSession, hashPassword } from "@/lib/server-auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  const normalizedUsername = String(username ?? "").trim().toLowerCase();
  const rawPassword = String(password ?? "").trim();

  if (normalizedUsername.length < 3 || rawPassword.length < 8) {
    return NextResponse.json(
      { error: "Username must be 3+ chars and password must be 8+ chars." },
      { status: 400 }
    );
  }

  const { data: existing } = await admin
    .from("app_users")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Username already exists." }, { status: 409 });
  }

  const passwordHash = hashPassword(rawPassword);
  const { data: user, error } = await admin
    .from("app_users")
    .insert({ username: normalizedUsername, password_hash: passwordHash })
    .select("id, username")
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "Failed to create account." }, { status: 500 });
  }

  await createSession(user.id);
  return NextResponse.json({ user });
}
