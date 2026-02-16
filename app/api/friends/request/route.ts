import { NextResponse } from "next/server";
import { admin, getSessionUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = await request.json();
  const targetUsername = String(username ?? "").trim().toLowerCase();

  if (!targetUsername) return NextResponse.json({ error: "Username is required." }, { status: 400 });
  if (targetUsername === me.username)
    return NextResponse.json({ error: "You cannot add yourself." }, { status: 400 });

  const { data: target } = await admin
    .from("app_users")
    .select("id, username")
    .eq("username", targetUsername)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "That username does not exist." }, { status: 404 });

  const { data: existing } = await admin
    .from("friend_requests")
    .select("id")
    .or(
      `and(from_user_id.eq.${me.id},to_user_id.eq.${target.id}),and(from_user_id.eq.${target.id},to_user_id.eq.${me.id})`
    )
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Request/friendship already exists." }, { status: 409 });
  }

  const { error } = await admin
    .from("friend_requests")
    .insert({ from_user_id: me.id, to_user_id: target.id, status: "pending" });

  if (error) return NextResponse.json({ error: "Could not send request." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
