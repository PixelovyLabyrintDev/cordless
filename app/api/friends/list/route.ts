import { NextResponse } from "next/server";
import { admin, getSessionUser, serverAuthConfigError } from "@/lib/server-auth";

export async function GET() {
  if (serverAuthConfigError) {
    return NextResponse.json({ error: serverAuthConfigError }, { status: 500 });
  }

  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: requests, error: requestsError } = await admin
    .from("friend_requests")
    .select("id, from_user_id, to_user_id, status, created_at")
    .or(`from_user_id.eq.${me.id},to_user_id.eq.${me.id}`)
    .order("created_at", { ascending: false });

  if (requestsError) {
    console.error("List requests failed", requestsError);
    return NextResponse.json({ error: "Could not load friend requests." }, { status: 500 });
  }

  const rows = requests ?? [];
  const ids = [...new Set(rows.flatMap((r) => [r.from_user_id, r.to_user_id]))];

  let usernamesById: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: users, error: usersError } = await admin
      .from("app_users")
      .select("id, username")
      .in("id", ids);

    if (usersError) {
      console.error("List users failed", usersError);
      return NextResponse.json({ error: "Could not resolve usernames." }, { status: 500 });
    }

    usernamesById = Object.fromEntries((users ?? []).map((u) => [u.id, u.username]));
  }

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
