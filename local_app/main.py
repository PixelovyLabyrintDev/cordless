"""Local TeamSpeak-like desktop UI prototype.

Run with:
    python local_app/main.py
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk


class LocalTeamSpeakUI(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Local App - TeamSpeak-style Prototype")
        self.geometry("1100x700")
        self.minsize(900, 560)

        self.channel_nodes: dict[str, str] = {}
        self.channel_chat: dict[str, list[str]] = {
            "General": ["[System] Welcome to #General."],
            "Gaming": ["[System] Welcome to #Gaming."],
            "AFK": ["[System] You are now marked idle in #AFK."],
        }
        self.current_channel = "General"
        self.host_mode_enabled = tk.BooleanVar(value=False)

        self._build_style()
        self._build_layout()
        self._set_channel("General")

    def _build_style(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        style.configure("Header.TLabel", font=("Segoe UI", 12, "bold"))
        style.configure("Muted.TButton", foreground="#444")

    def _build_layout(self) -> None:
        root = ttk.Frame(self, padding=8)
        root.pack(fill="both", expand=True)

        main_split = ttk.Panedwindow(root, orient="horizontal")
        main_split.pack(fill="both", expand=True)

        # Left pane: host mode + server/channel tree
        left = ttk.Frame(main_split, padding=6)
        main_split.add(left, weight=2)

        left_header = ttk.Frame(left)
        left_header.pack(fill="x")
        ttk.Label(left_header, text="Servers & Channels", style="Header.TLabel").pack(side="left")
        ttk.Checkbutton(
            left_header,
            text="Host mode",
            variable=self.host_mode_enabled,
            command=self._toggle_host_mode,
        ).pack(side="right")

        self.tree = ttk.Treeview(left, show="tree", selectmode="browse")
        self.tree.pack(fill="both", expand=True, pady=(8, 0))

        lobby = self.tree.insert("", "end", text="Local Server")
        self.channel_nodes["General"] = self.tree.insert(lobby, "end", text="General")
        self.channel_nodes["Gaming"] = self.tree.insert(lobby, "end", text="Gaming")
        self.channel_nodes["AFK"] = self.tree.insert(lobby, "end", text="AFK")
        self.tree.item(lobby, open=True)

        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)

        # Right pane: split between activity + chat
        right = ttk.Panedwindow(main_split, orient="vertical")
        main_split.add(right, weight=5)

        # Top-right: activity log / voice status
        activity = ttk.Frame(right, padding=6)
        right.add(activity, weight=3)
        ttk.Label(activity, text="Voice Activity", style="Header.TLabel").pack(anchor="w")

        self.activity_box = tk.Text(activity, height=10, wrap="word")
        self.activity_box.pack(fill="both", expand=True, pady=(8, 0))
        self._append_activity("[System] UI scaffold ready.")
        self._append_activity("[Hint] Select channels on the left to switch chat context.")

        # Bottom-right: text chat + controls
        chat = ttk.Frame(right, padding=6)
        right.add(chat, weight=2)

        self.chat_header_var = tk.StringVar(value="Channel Chat - #General")
        ttk.Label(chat, textvariable=self.chat_header_var, style="Header.TLabel").pack(anchor="w")

        self.chat_log = tk.Text(chat, height=8, wrap="word")
        self.chat_log.pack(fill="both", expand=True, pady=(8, 6))

        message_row = ttk.Frame(chat)
        message_row.pack(fill="x")
        self.msg_entry = ttk.Entry(message_row)
        self.msg_entry.pack(side="left", fill="x", expand=True)
        self.msg_entry.bind("<Return>", self._send_message)
        ttk.Button(message_row, text="Send", command=self._send_message).pack(side="left", padx=(6, 0))

        controls = ttk.Frame(chat)
        controls.pack(fill="x", pady=(8, 0))
        ttk.Button(controls, text="Mute Mic").pack(side="left")
        ttk.Button(controls, text="Deafen").pack(side="left", padx=(6, 0))
        ttk.Button(controls, text="Settings").pack(side="right")

    def _append_activity(self, message: str) -> None:
        self.activity_box.configure(state="normal")
        self.activity_box.insert("end", f"{message}\n")
        self.activity_box.see("end")
        self.activity_box.configure(state="disabled")

    def _set_channel(self, channel_name: str) -> None:
        self.current_channel = channel_name
        self.chat_header_var.set(f"Channel Chat - #{channel_name}")
        self.chat_log.configure(state="normal")
        self.chat_log.delete("1.0", "end")
        for line in self.channel_chat.get(channel_name, []):
            self.chat_log.insert("end", f"{line}\n")
        self.chat_log.configure(state="disabled")

    def _on_tree_select(self, _event: tk.Event) -> None:
        selected = self.tree.selection()
        if not selected:
            return

        selected_item = selected[0]
        for channel_name, item_id in self.channel_nodes.items():
            if selected_item == item_id:
                self._set_channel(channel_name)
                self._append_activity(f"[System] Switched to #{channel_name}.")
                return

    def _send_message(self, _event: tk.Event | None = None) -> None:
        text = self.msg_entry.get().strip()
        if not text:
            return

        self.channel_chat.setdefault(self.current_channel, []).append(f"You: {text}")
        self.msg_entry.delete(0, "end")
        self._set_channel(self.current_channel)

    def _toggle_host_mode(self) -> None:
        if self.host_mode_enabled.get():
            self._append_activity("[Host] Host mode enabled. Ensure required ports are forwarded.")
        else:
            self._append_activity("[Host] Host mode disabled.")


if __name__ == "__main__":
    LocalTeamSpeakUI().mainloop()
