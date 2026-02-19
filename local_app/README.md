# local_app

Basic Python desktop UI scaffold for a TeamSpeak3-like local application.

## Run

```bash
python local_app/main.py
```

## Current status

- Static UI prototype only (no networking/audio yet)
- Includes:
  - Server/channel tree (no placeholder users)
  - Channel-linked chat panel (chat updates when selected channel changes)
  - Voice activity log panel
  - Host mode toggle for users who have forwarded required ports
  - Basic control buttons (mute/deafen/settings)
