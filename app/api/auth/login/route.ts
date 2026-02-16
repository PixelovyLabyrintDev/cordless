import { NextResponse } from "next/server";
import { admin, createSession, serverAuthConfigError, verifyPassword } from "@/lib/server-auth";

export async function POST(request: Request) {
  if (serverAuthConfigError) {
    return NextResponse.json({ error: serverAuthConfigError }, { status: 500 });
  }

  const { username, password } = await request.json();
  const normalizedUsername = String(username ?? "").trim().toLowerCase();
  const rawPassword = String(password ?? "").trim();

  const { data: user, error } = await admin
    .from("app_users")
    .select("id, username, password_hash")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (error) {
    console.error("Login lookup failed", error);
    return NextResponse.json(
      {
        error:
          "Login failed due to database configuration. Ensure supabase/schema.sql has been executed."
      },
      { status: 500 }
    );
  }

  if (!user || !verifyPassword(rawPassword, user.password_hash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, username: user.username } });
}
