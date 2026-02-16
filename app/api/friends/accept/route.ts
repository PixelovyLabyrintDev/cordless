import { NextResponse } from "next/server";
import { admin, getSessionUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId } = await request.json();
  const id = String(requestId ?? "");
  if (!id) return NextResponse.json({ error: "requestId is required" }, { status: 400 });

  const { error } = await admin
    .from("friend_requests")
    .update({ status: "accepted" })
    .eq("id", id)
    .eq("to_user_id", me.id);

  if (error) return NextResponse.json({ error: "Could not accept request." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
