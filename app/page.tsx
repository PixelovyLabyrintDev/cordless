"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RealtimePostgresInsertPayload, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  handle: string;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
};

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [requestHandle, setRequestHandle] = useState("");
  const [friendRequests, setFriendRequests] = useState<Array<Record<string, string>>>([]);
  const [messageToHandle, setMessageToHandle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState("Connecting...");

  const myId = user?.id;

  const knownHandles = useMemo(() => {
    const handles = new Set<string>();
    if (profile?.handle) handles.add(profile.handle);
    if (messageToHandle) handles.add(messageToHandle);
    return [...handles];
  }, [profile?.handle, messageToHandle]);

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          setStatus(`Auth failed: ${error.message}`);
          return;
        }
        setUser(data.user ?? null);
      } else {
        setUser(session.user);
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!myId) return;

    const loadInitial = async () => {
      setStatus("Connected.");
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, handle")
        .eq("id", myId)
        .maybeSingle();

      if (existingProfile) {
        setProfile(existingProfile);
        setHandleInput(existingProfile.handle);
      }

      const { data: requestRows } = await supabase
        .from("friend_requests")
        .select("id, status, from_user:profiles!friend_requests_from_user_id_fkey(handle), to_user:profiles!friend_requests_to_user_id_fkey(handle)")
        .or(`from_user_id.eq.${myId},to_user_id.eq.${myId}`)
        .order("created_at", { ascending: false });

      setFriendRequests((requestRows as Array<Record<string, string>>) ?? []);

      const { data: messageRows } = await supabase
        .from("direct_messages")
        .select("id, sender_id, receiver_id, body, created_at")
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order("created_at", { ascending: false })
        .limit(50);

      setMessages((messageRows ?? []) as Message[]);
    };

    void loadInitial();

    const channel = supabase
      .channel("cordless-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload: RealtimePostgresInsertPayload<Message>) => {
          const row = payload.new;
          if (row.sender_id === myId || row.receiver_id === myId) {
            setMessages((prev) => [row, ...prev].slice(0, 50));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId]);

  const upsertProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!myId || !handleInput.trim()) return;

    const normalized = handleInput.trim().toLowerCase();
    const { error } = await supabase.from("profiles").upsert({ id: myId, handle: normalized });

    if (error) {
      setStatus(`Could not save handle: ${error.message}`);
      return;
    }

    setProfile({ id: myId, handle: normalized });
    setStatus("Handle saved.");
  };

  const sendFriendRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!myId || !requestHandle.trim()) return;

    const { data: target } = await supabase
      .from("profiles")
      .select("id, handle")
      .eq("handle", requestHandle.trim().toLowerCase())
      .maybeSingle();

    if (!target) {
      setStatus("No user found with that handle.");
      return;
    }

    const { error } = await supabase
      .from("friend_requests")
      .insert({ from_user_id: myId, to_user_id: target.id, status: "pending" });

    if (error) {
      setStatus(`Could not send request: ${error.message}`);
      return;
    }

    setStatus("Friend request sent.");
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!myId || !messageBody.trim() || !messageToHandle.trim()) return;

    const { data: target } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", messageToHandle.trim().toLowerCase())
      .maybeSingle();

    if (!target) {
      setStatus("Recipient handle not found.");
      return;
    }

    const { error } = await supabase.from("direct_messages").insert({
      sender_id: myId,
      receiver_id: target.id,
      body: messageBody.trim()
    });

    if (error) {
      setStatus(`Could not send message: ${error.message}`);
      return;
    }

    setMessageBody("");
    setStatus("Message sent.");
  };

  return (
    <main>
      <h1>Cordless MVP</h1>
      <p>
        A first pass at a Discord-like app on Supabase + Vercel. This uses anonymous auth,
        profiles, friend requests, and realtime direct messages.
      </p>
      <p>Status: {status}</p>

      <section>
        <h2>1) Your identity</h2>
        <form onSubmit={upsertProfile} className="row">
          <input
            value={handleInput}
            onChange={(e) => setHandleInput(e.target.value)}
            placeholder="pick-handle"
          />
          <button type="submit">Save handle</button>
        </form>
        {profile ? <p>Signed in as: <strong>{profile.handle}</strong></p> : <p>No handle yet.</p>}
      </section>

      <section>
        <h2>2) Add friends</h2>
        <form onSubmit={sendFriendRequest} className="row">
          <input
            value={requestHandle}
            onChange={(e) => setRequestHandle(e.target.value)}
            placeholder="friend handle"
          />
          <button type="submit">Send request</button>
        </form>
        <ul>
          {friendRequests.map((req, idx) => (
            <li key={`${req.id ?? idx}`}>
              {JSON.stringify(req)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>3) Direct messages</h2>
        <form onSubmit={sendMessage}>
          <div className="row">
            <input
              value={messageToHandle}
              onChange={(e) => setMessageToHandle(e.target.value)}
              placeholder="recipient handle"
            />
            <input
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="say something"
            />
            <button type="submit">Send</button>
          </div>
        </form>

        <h3>Recent messages</h3>
        <div>
          {messages.map((msg) => (
            <div className="message" key={msg.id}>
              <div>
                <strong>{msg.sender_id === myId ? "You" : msg.sender_id}</strong> → {msg.receiver_id === myId ? "You" : msg.receiver_id}
              </div>
              <div>{msg.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Known handles (local)</h2>
        <p>{knownHandles.join(", ") || "None yet"}</p>
      </section>
    </main>
  );
}
