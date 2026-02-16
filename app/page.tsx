"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  User
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  username: string;
};

type FriendRequest = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
};

const usernameToEmail = (username: string) => `${username}@cordless.local`;

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");

  const [friendUsername, setFriendUsername] = useState("");
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [incomingNotifications, setIncomingNotifications] = useState<string[]>([]);

  const [usernamesById, setUsernamesById] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("Ready.");

  const myId = user?.id;

  const loadUsernames = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    const { data } = await supabase.from("profiles").select("id, username").in("id", uniqueIds);

    if (!data) return;

    const mapped = data.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.username;
      return acc;
    }, {});

    setUsernamesById((prev) => ({ ...prev, ...mapped }));
  }, []);

  const friendUsernames = useMemo(() => {
    if (!myId) return [] as string[];

    return friendRequests
      .filter((request) => request.status === "accepted")
      .map((request) => (request.from_user_id === myId ? request.to_user_id : request.from_user_id))
      .map((friendId) => usernamesById[friendId] ?? friendId);
  }, [friendRequests, myId, usernamesById]);

  const pendingIncoming = useMemo(
    () => friendRequests.filter((request) => request.to_user_id === myId && request.status === "pending"),
    [friendRequests, myId]
  );

  const hydrateProfileAndRequests = useCallback(async (sessionUser: User) => {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", sessionUser.id)
      .maybeSingle();

    setProfile(existingProfile ?? null);

    const { data: requests } = await supabase
      .from("friend_requests")
      .select("id, from_user_id, to_user_id, status, created_at")
      .or(`from_user_id.eq.${sessionUser.id},to_user_id.eq.${sessionUser.id}`)
      .order("created_at", { ascending: false });

    const typedRequests = (requests ?? []) as FriendRequest[];
    setFriendRequests(typedRequests);

    await loadUsernames([
      sessionUser.id,
      ...typedRequests.map((request) => request.from_user_id),
      ...typedRequests.map((request) => request.to_user_id)
    ]);
  }, [loadUsernames]);

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        await hydrateProfileAndRequests(session.user);
      }
    };

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        void hydrateProfileAndRequests(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setFriendRequests([]);
        setUsernamesById({});
      }
    });

    void bootstrap();

    return () => {
      subscription.unsubscribe();
    };
  }, [hydrateProfileAndRequests]);

  useEffect(() => {
    if (!myId) return;

    const channel = supabase
      .channel(`friend-requests-${myId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friend_requests" },
        async (payload: RealtimePostgresInsertPayload<FriendRequest>) => {
          const request = payload.new;

          if (request.from_user_id === myId || request.to_user_id === myId) {
            setFriendRequests((prev) => [request, ...prev]);
          }

          await loadUsernames([request.from_user_id, request.to_user_id]);

          if (request.to_user_id === myId) {
            const { data: sender } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", request.from_user_id)
              .maybeSingle();

            const senderUsername = sender?.username ?? "Someone";
            setIncomingNotifications((prev) => [`${senderUsername} sent you a friend request.`, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "friend_requests" },
        (payload: RealtimePostgresUpdatePayload<FriendRequest>) => {
          const request = payload.new;
          if (request.from_user_id === myId || request.to_user_id === myId) {
            setFriendRequests((prev) => prev.map((item) => (item.id === request.id ? request : item)));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadUsernames, myId]);

  const submitAuth = async (e: FormEvent) => {
    e.preventDefault();

    const normalizedUsername = usernameInput.trim().toLowerCase();
    if (!normalizedUsername || !passwordInput.trim()) {
      setStatus("Please enter both username and password.");
      return;
    }

    if (normalizedUsername.length < 3) {
      setStatus("Username must be at least 3 characters.");
      return;
    }

    const email = usernameToEmail(normalizedUsername);

    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: passwordInput.trim()
      });

      if (error) {
        setStatus(`Could not create account: ${error.message}`);
        return;
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({ id: data.user.id, username: normalizedUsername });

        if (profileError) {
          setStatus(`Account created, but profile failed: ${profileError.message}`);
          return;
        }
      }

      setStatus("Account created. You are signed in.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: passwordInput.trim()
    });

    if (error) {
      setStatus(`Login failed: ${error.message}`);
      return;
    }

    setStatus("Logged in.");
  };

  const sendFriendRequest = async (e: FormEvent) => {
    e.preventDefault();

    if (!myId || !friendUsername.trim()) return;

    const targetUsername = friendUsername.trim().toLowerCase();

    if (targetUsername === profile?.username) {
      setStatus("You cannot add yourself.");
      return;
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", targetUsername)
      .maybeSingle();

    if (!targetProfile) {
      setStatus("That username does not exist.");
      return;
    }

    const { data: existing } = await supabase
      .from("friend_requests")
      .select("id")
      .or(
        `and(from_user_id.eq.${myId},to_user_id.eq.${targetProfile.id}),and(from_user_id.eq.${targetProfile.id},to_user_id.eq.${myId})`
      )
      .maybeSingle();

    if (existing) {
      setStatus("A friend relationship or request already exists with this user.");
      return;
    }

    const { error } = await supabase.from("friend_requests").insert({
      from_user_id: myId,
      to_user_id: targetProfile.id,
      status: "pending"
    });

    if (error) {
      setStatus(`Could not send friend request: ${error.message}`);
      return;
    }

    setStatus("Friend request sent.");
    setFriendUsername("");
  };

  const acceptRequest = async (requestId: string) => {
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", requestId);

    if (error) {
      setStatus(`Could not accept request: ${error.message}`);
      return;
    }

    setStatus("Friend request accepted.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setStatus("Signed out.");
  };

  if (!user || !profile) {
    return (
      <main>
        <section className="card auth-card">
          <h1>Cordless</h1>
          <p>Create an account or sign in with username + password.</p>

          <div className="row">
            <button type="button" onClick={() => setAuthMode("signup")} data-active={authMode === "signup"}>
              Sign up
            </button>
            <button type="button" onClick={() => setAuthMode("login")} data-active={authMode === "login"}>
              Log in
            </button>
          </div>

          <form onSubmit={submitAuth} className="stack">
            <input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="username"
              autoComplete="username"
            />
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="password"
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
            />
            <button type="submit">{authMode === "signup" ? "Create account" : "Log in"}</button>
          </form>

          <p>Status: {status}</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="card">
        <div className="row between">
          <div>
            <h1>Cordless</h1>
            <p>
              Signed in as <strong>{profile.username}</strong>.
            </p>
          </div>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
        <p>Status: {status}</p>
      </section>

      {incomingNotifications.length > 0 && (
        <section className="card">
          <h2>Notifications</h2>
          <ul>
            {incomingNotifications.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Friends</h2>
        {friendUsernames.length === 0 ? (
          <p>You have no friends yet. Add someone below.</p>
        ) : (
          <ul>
            {friendUsernames.map((friend) => (
              <li key={friend}>{friend}</li>
            ))}
          </ul>
        )}

        <form onSubmit={sendFriendRequest} className="row">
          <input
            value={friendUsername}
            onChange={(e) => setFriendUsername(e.target.value)}
            placeholder="friend username"
          />
          <button type="submit">Add friend</button>
        </form>
      </section>

      <section className="card">
        <h2>Incoming friend requests</h2>
        {pendingIncoming.length === 0 ? (
          <p>No pending requests.</p>
        ) : (
          <ul>
            {pendingIncoming.map((request) => (
              <li key={request.id} className="row between">
                <span>{usernamesById[request.from_user_id] ?? request.from_user_id}</span>
                <button type="button" onClick={() => acceptRequest(request.id)}>
                  Accept
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
