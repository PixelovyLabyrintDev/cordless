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

        self._build_style()
        self._build_layout()

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

        # Top connection bar
        top_bar = ttk.Frame(root)
        top_bar.pack(fill="x", pady=(0, 8))

        ttk.Label(top_bar, text="Server:").pack(side="left")
        self.server_entry = ttk.Entry(top_bar)
        self.server_entry.insert(0, "localhost")
        self.server_entry.pack(side="left", padx=(6, 10), ipadx=50)

        ttk.Label(top_bar, text="Nickname:").pack(side="left")
        self.nickname_entry = ttk.Entry(top_bar)
        self.nickname_entry.insert(0, "GuestUser")
        self.nickname_entry.pack(side="left", padx=(6, 10), ipadx=30)

        ttk.Button(top_bar, text="Connect").pack(side="left")
        ttk.Button(top_bar, text="Disconnect", style="Muted.TButton").pack(side="left", padx=(6, 0))

        # Main area
        main_split = ttk.Panedwindow(root, orient="horizontal")
        main_split.pack(fill="both", expand=True)

        # Left pane: server/channel tree
        left = ttk.Frame(main_split, padding=6)
        main_split.add(left, weight=2)

        ttk.Label(left, text="Servers & Channels", style="Header.TLabel").pack(anchor="w")

        self.tree = ttk.Treeview(left, show="tree", selectmode="browse")
        self.tree.pack(fill="both", expand=True, pady=(8, 0))

        lobby = self.tree.insert("", "end", text="Local Server")
        general = self.tree.insert(lobby, "end", text="General")
        gaming = self.tree.insert(lobby, "end", text="Gaming")
        self.tree.insert(general, "end", text="🔊 Alice")
        self.tree.insert(general, "end", text="🔊 You")
        self.tree.insert(gaming, "end", text="🔊 Bob")
        self.tree.item(lobby, open=True)
        self.tree.item(general, open=True)
        self.tree.item(gaming, open=True)

        # Right pane: split between activity + chat
        right = ttk.Panedwindow(main_split, orient="vertical")
        main_split.add(right, weight=5)

        # Top-right: activity log / voice status
        activity = ttk.Frame(right, padding=6)
        right.add(activity, weight=3)
        ttk.Label(activity, text="Voice Activity", style="Header.TLabel").pack(anchor="w")

        self.activity_box = tk.Text(activity, height=10, wrap="word")
        self.activity_box.pack(fill="both", expand=True, pady=(8, 0))
        self.activity_box.insert("end", "[System] UI scaffold ready.\n")
        self.activity_box.insert("end", "[Hint] Next step: wire audio networking and channel events.\n")
        self.activity_box.configure(state="disabled")

        # Bottom-right: text chat + controls
        chat = ttk.Frame(right, padding=6)
        right.add(chat, weight=2)
        ttk.Label(chat, text="Channel Chat", style="Header.TLabel").pack(anchor="w")

        self.chat_log = tk.Text(chat, height=8, wrap="word")
        self.chat_log.pack(fill="both", expand=True, pady=(8, 6))
        self.chat_log.insert("end", "Alice: Welcome to #General\n")
        self.chat_log.insert("end", "Bob: Push-to-talk test complete.\n")
        self.chat_log.configure(state="disabled")

        message_row = ttk.Frame(chat)
        message_row.pack(fill="x")
        self.msg_entry = ttk.Entry(message_row)
        self.msg_entry.pack(side="left", fill="x", expand=True)
        ttk.Button(message_row, text="Send").pack(side="left", padx=(6, 0))

        controls = ttk.Frame(chat)
        controls.pack(fill="x", pady=(8, 0))
        ttk.Button(controls, text="Mute Mic").pack(side="left")
        ttk.Button(controls, text="Deafen").pack(side="left", padx=(6, 0))
        ttk.Button(controls, text="Settings").pack(side="right")


if __name__ == "__main__":
    LocalTeamSpeakUI().mainloop()
