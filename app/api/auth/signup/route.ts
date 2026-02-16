import { NextResponse } from "next/server";
import { admin, createSession, hashPassword, serverAuthConfigError } from "@/lib/server-auth";

export async function POST(request: Request) {
  if (serverAuthConfigError) {
    return NextResponse.json({ error: serverAuthConfigError }, { status: 500 });
  }

  const { username, password } = await request.json();

  const normalizedUsername = String(username ?? "").trim().toLowerCase();
  const rawPassword = String(password ?? "").trim();

  if (normalizedUsername.length < 3 || rawPassword.length < 8) {
    return NextResponse.json(
      { error: "Username must be 3+ chars and password must be 8+ chars." },
      { status: 400 }
    );
  }

  const { data: existing, error: existingError } = await admin
    .from("app_users")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (existingError) {
    console.error("Signup lookup failed", existingError);
    return NextResponse.json(
      {
        error:
          "Database check failed. Ensure supabase/schema.sql has been executed (app_users table must exist)."
      },
      { status: 500 }
    );
  }

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
    console.error("Signup insert failed", error);

    if (error?.code === "23505") {
      return NextResponse.json({ error: "Username already exists." }, { status: 409 });
    }

    const message = error?.message?.includes('relation "public.app_users" does not exist')
      ? "Database table app_users is missing. Run supabase/schema.sql in your Supabase SQL editor."
      : `Failed to create account: ${error?.message ?? "unknown database error"}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await createSession(user.id);
  } catch (sessionError) {
    console.error("Session creation failed", sessionError);
    return NextResponse.json(
      {
        error:
          "Account created, but session failed. Check app_sessions table and SUPABASE_SERVICE_ROLE_KEY configuration."
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ user });
}
