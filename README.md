# Hyperspell Knowledge 3D (OpenClaw Plugin)

Cinematic Three.js galaxy visualization for Hyperspell memories and image-related context.

## What it adds

- Tool: `hyperspell_knowledge_viz`
- Plugin command: `/hyperspell_viz3d`
- Plugin CLI command: `openclaw hyperspell-viz3d`
- Route: `/plugins/hyperspell-knowledge-3d` (interactive 3D UI)
- Route: `/plugins/hyperspell-knowledge-3d/data` (graph JSON)
- Skill command: `hyperspell_knowledge_viz` (direct tool dispatch)

## Install (local dev link)

1. Set env var for your gateway process:

   - `HYPERSPELL_API_KEY=...`

2. Install plugin:

   - `openclaw plugins install -l /Users/ziad/expoapps/cardboard`

3. Restart gateway:

   - `openclaw gateway restart`

## Optional plugin config

In `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    entries: {
      "hyperspell-knowledge-3d": {
        enabled: true,
        config: {
          apiBase: "https://api.hyperspell.com",
          lookbackDays: 180,
          maxDocs: 800,
          imageKeywordBoost: 1.5
        }
      }
    }
  }
}
```

## Use

- Invoke the skill command or tool from chat:
  - `/hyperspell_knowledge_viz`
- Or use plugin command that bypasses tool routing:
  - `/hyperspell_viz3d`
- Or generate URL from terminal:
  - `openclaw hyperspell-viz3d --sender ziadbc@gmail.com`
- It returns a URL like:
  - `/plugins/hyperspell-knowledge-3d?token=...`
- Open that URL in OpenClaw web/control UI to view the 3D galaxy.

## Notes

- Sender identity is mapped from OpenClaw runtime context to Hyperspell `X-As-User`.
- V1 is metadata-first image detection (no forced thumbnail rendering).
- Cached graph tokens expire after 10 minutes.
