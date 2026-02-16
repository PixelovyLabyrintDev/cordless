"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Me = { id: string; username: string };

type IncomingRequest = {
  id: string;
  from_username: string;
};

type DashboardData = {
  me: Me;
  friends: string[];
  incomingPending: IncomingRequest[];
};

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [friendUsername, setFriendUsername] = useState("");
  const [friends, setFriends] = useState<string[]>([]);
  const [incomingPending, setIncomingPending] = useState<IncomingRequest[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [status, setStatus] = useState("Ready.");

  const prevIncomingCount = useRef(0);

  const authed = Boolean(me);

  const refreshDashboard = async () => {
    const response = await fetch("/api/friends/list", { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as
      | DashboardData
      | { error?: string };

    if (!response.ok) {
      if (response.status === 401) {
        setMe(null);
        setFriends([]);
        setIncomingPending([]);
      } else if ("error" in data && data.error) {
        setStatus(data.error);
      } else {
        setStatus(`Could not refresh dashboard (${response.status}).`);
      }
      return;
    }

    const dashboard = data as DashboardData;

    setMe(dashboard.me);
    setFriends(dashboard.friends ?? []);
    setIncomingPending(dashboard.incomingPending ?? []);

    if ((dashboard.incomingPending?.length ?? 0) > prevIncomingCount.current) {
      const newest = dashboard.incomingPending[0];
      if (newest) {
        setNotifications((prev) => [
          `${newest.from_username} sent you a friend request.`,
          ...prev
        ]);
      }
    }

    prevIncomingCount.current = dashboard.incomingPending?.length ?? 0;
  };

  useEffect(() => {
    const checkMe = async () => {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) return;

      const data = await response.json();
      setMe(data.user);
    };

    void checkMe();
  }, []);

  useEffect(() => {
    if (!authed) return;

    void refreshDashboard();
    const timer = setInterval(() => {
      void refreshDashboard();
    }, 3000);

    return () => clearInterval(timer);
  }, [authed]);

  const submitAuth = async (e: FormEvent) => {
    e.preventDefault();

    const username = usernameInput.trim().toLowerCase();
    const password = passwordInput.trim();

    if (!username || !password) {
      setStatus("Please enter username and password.");
      return;
    }

    const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string; user?: Me };

      if (!response.ok) {
        setStatus(data.error ?? `Authentication failed (${response.status}).`);
        return;
      }

      setMe(data.user ?? null);
      setStatus(authMode === "signup" ? "Account created." : "Logged in.");
      setPasswordInput("");
      await refreshDashboard();
    } catch {
      setStatus("Could not reach auth server. Please try again.");
    }
  };

  const sendFriendRequest = async (e: FormEvent) => {
    e.preventDefault();

    const target = friendUsername.trim().toLowerCase();
    if (!target) return;

    const response = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: target })
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      alreadyExists?: boolean;
    };

    if (!response.ok) {
      setStatus(data.error ?? `Could not send request (${response.status}).`);
      if (response.status === 409) {
        await refreshDashboard();
      }
      return;
    }

    setStatus("Friend request sent.");
    setFriendUsername("");
    await refreshDashboard();
  };

  const acceptRequest = async (requestId: string) => {
    const response = await fetch("/api/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId })
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error ?? "Could not accept request.");
      return;
    }

    setStatus("Friend request accepted.");
    await refreshDashboard();
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    setFriends([]);
    setIncomingPending([]);
    setNotifications([]);
    setStatus("Signed out.");
  };

  const emptyFriends = useMemo(() => friends.length === 0, [friends.length]);

  if (!authed) {
    return (
      <main>
        <section className="card auth-card">
          <h1>Cordless</h1>
          <p>Create an account or log in with username and password.</p>

          <div className="row">
            <button type="button" onClick={() => setAuthMode("signup")} data-active={authMode === "signup"}>
              Sign up
            </button>
            <button type="button" onClick={() => setAuthMode("login")} data-active={authMode === "login"}>
              Log in
            </button>
          </div>

          <form className="stack" onSubmit={submitAuth}>
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
              Signed in as <strong>{me?.username}</strong>
            </p>
          </div>
          <button onClick={signOut} type="button">
            Sign out
          </button>
        </div>
        <p>Status: {status}</p>
      </section>

      {notifications.length > 0 && (
        <section className="card">
          <h2>Notifications</h2>
          <ul>
            {notifications.map((notification, idx) => (
              <li key={`${notification}-${idx}`}>{notification}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Friends</h2>
        {emptyFriends ? (
          <p>You have no friends yet. Add someone.</p>
        ) : (
          <ul>
            {friends.map((friend) => (
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
        {incomingPending.length === 0 ? (
          <p>No pending requests.</p>
        ) : (
          <ul>
            {incomingPending.map((request) => (
              <li className="row between" key={request.id}>
                <span>{request.from_username}</span>
                <button onClick={() => acceptRequest(request.id)} type="button">
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
