import { NextResponse } from "next/server";
import { admin, getSessionUser, serverAuthConfigError } from "@/lib/server-auth";

export async function POST(request: Request) {
  if (serverAuthConfigError) {
    return NextResponse.json({ error: serverAuthConfigError }, { status: 500 });
  }

  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = await request.json();
  const targetUsername = String(username ?? "").trim().toLowerCase();

  if (!targetUsername) return NextResponse.json({ error: "Username is required." }, { status: 400 });
  if (targetUsername === me.username) {
    return NextResponse.json({ error: "You cannot add yourself." }, { status: 400 });
  }

  const { data: target, error: targetError } = await admin
    .from("app_users")
    .select("id, username")
    .eq("username", targetUsername)
    .maybeSingle();

  if (targetError) {
    console.error("Friend target lookup failed", targetError);
    return NextResponse.json({ error: "Could not verify target username." }, { status: 500 });
  }

  if (!target) return NextResponse.json({ error: "That username does not exist." }, { status: 404 });

  const { data: existingForward, error: forwardError } = await admin
    .from("friend_requests")
    .select("id, status")
    .eq("from_user_id", me.id)
    .eq("to_user_id", target.id)
    .maybeSingle();

  if (forwardError) {
    console.error("Friend forward lookup failed", forwardError);
    return NextResponse.json({ error: "Could not verify existing requests." }, { status: 500 });
  }

  const { data: existingReverse, error: reverseError } = await admin
    .from("friend_requests")
    .select("id, status")
    .eq("from_user_id", target.id)
    .eq("to_user_id", me.id)
    .maybeSingle();

  if (reverseError) {
    console.error("Friend reverse lookup failed", reverseError);
    return NextResponse.json({ error: "Could not verify existing requests." }, { status: 500 });
  }

  if (existingForward || existingReverse) {
    return NextResponse.json({ error: "Request/friendship already exists." }, { status: 409 });
  }

  const { data: inserted, error: insertError } = await admin
    .from("friend_requests")
    .insert({ from_user_id: me.id, to_user_id: target.id, status: "pending" })
    .select("id, status")
    .single();

  if (insertError) {
    console.error("Friend request insert failed", insertError);

    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Friend request already exists.", alreadyExists: true },
        { status: 409 }
      );
    }

    if (insertError.code === "23503") {
      return NextResponse.json(
        {
          error:
            "Friend request schema mismatch detected (foreign key). Re-run supabase/schema.sql to recreate tables with app_users foreign keys."
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `Could not send request: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, request: inserted });
}
