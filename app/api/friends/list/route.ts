import { NextResponse } from "next/server";
import { admin, getSessionUser } from "@/lib/server-auth";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: requests } = await admin
    .from("friend_requests")
    .select("id, from_user_id, to_user_id, status, created_at")
    .or(`from_user_id.eq.${me.id},to_user_id.eq.${me.id}`)
    .order("created_at", { ascending: false });

  const rows = requests ?? [];
  const ids = [...new Set(rows.flatMap((r) => [r.from_user_id, r.to_user_id]))];

  const { data: users } = await admin.from("app_users").select("id, username").in("id", ids);
  const usernamesById = Object.fromEntries((users ?? []).map((u) => [u.id, u.username]));

  const incomingPending = rows.filter((r) => r.to_user_id === me.id && r.status === "pending");
  const friends = rows
    .filter((r) => r.status === "accepted")
    .map((r) => (r.from_user_id === me.id ? r.to_user_id : r.from_user_id))
    .map((id) => usernamesById[id] ?? id);

  return NextResponse.json({
    me,
    requests: rows,
    incomingPending: incomingPending.map((r) => ({
      ...r,
      from_username: usernamesById[r.from_user_id] ?? r.from_user_id
    })),
    friends,
    usernamesById
  });
}
