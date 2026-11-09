# Video style guide

How every AgentGuard video looks and sounds. The scripts in this folder assume it. When a script and
this guide disagree, the script wins for that video only.

## Source of truth

Every claim in a video comes from one of these files, as they stand in the repository:
`README.md`, `docs/final-report.md`, `docs/self-host.md`, `docs/security-review.md`, `LAUNCH.md`,
`SECURITY.md`, `SPEC.md`, `site/index.html`, `packages/mcp-server/README.md`. If a line can't be traced
to one of them, cut it. When a number changes in those files, change it in the script before recording.

## Tone

- **Calm, exact, plain.** We talk like an engineer explaining a design to a peer, not like an ad.
- **Lead with the risk, then the bound.** "An agent with a key can spend everything. Here is the most
  it can cost with AgentGuard, and why."
- **Say what is early.** Every video that mentions mainnet also says, in one line, that the software
  is new and that the known risks are written down.
- **Short sentences.** One idea per sentence, about 2.5 spoken words per second.
- **Concrete over abstract.** "20 a day per chain", "one Phantom signature", "0.50 USDG over x402",
  not "secure", "powerful" or "seamless".

## What we never say

- "Unhackable", "100% safe", "bulletproof", "guaranteed", "risk-free", "bank-grade", "military-grade".
- Any number that is not in the source files: users, stars, downloads, volume, savings, uptime.
- Any partnership, integration "with" a company, endorsement or audit of AgentGuard itself. Squads v4,
  Safe and the Allowance Module are audited; AgentGuard's own code had a pre-release review
  (`docs/security-review.md`), **not a third-party audit**. Say "built on audited onchain
  primitives", never "audited".
- Anything about a token, a price, an airdrop, points or rewards. A token is only a proposal (CR-009)
  awaiting legal review.
- Investment or yield language: "earn", "returns", "profit", "moon".
- "Hosted", "sign up", "our service". There is no hosted service; everyone runs their own copy.
- That Solana or Base mainnet is live, until the owner confirms it. Robinhood Chain mainnet is live
  today; Solana is "next"; Base is "later".

## The AI presenter

- **Disclosure:** every video description starts with `AI presenter.` and the on-screen text of the
  first scene carries a small `AI presenter` label in the lower-left corner (Inter 500, 22 px on a
  1080-wide frame, `#a0a0a5`).
- **Look:** a neutral, professional presenter in their thirties; dark charcoal or black crew-neck or
  overshirt, no logos, no jewelry that catches light. Calm, direct, friendly; not a salesperson.
- **Setting:** a dark studio, near-black background (`#050505` to `#0d0d0d`) with a soft violet rim
  light from the upper right and a faint mint fill from the lower left, matching the site's gradient.
- **Framing, vertical 9:16:** medium close-up, eyes on the upper third, head and shoulders in the top
  55% of the frame. The lower 45% stays free for cards and captions. When a card is full screen,
  the presenter drops to a circular picture-in-picture (diameter 300 px, bottom-right, 40 px margin)
  or leaves the frame.
- **Framing, horizontal 16:9:** medium shot, presenter on the left third; screens and cards on the
  right two thirds.
- **Energy:** 6/10 by default. 7/10 for hooks, 5/10 for risks. No shouting, no fake surprise.
- **Gestures:** small, at chest height. Count on fingers for lists. A flat palm moving down for "cap".
  No pointing at the viewer.
- **Voice:** neutral international English, medium pace, clear consonants on numbers
  ("zero point five oh USDG", "twenty a day").

## Pronunciation

| Write      | Say                                    |
| ---------- | -------------------------------------- |
| x402       | "x four oh two"                        |
| USDG       | "U-S-D-G"                              |
| USDC       | "U-S-D-C"                              |
| MCP        | "M-C-P"                                |
| `/kill`    | "slash kill"                           |
| guard-core | "guard core"                           |
| Squads     | "squads"                               |
| Safe       | "safe" (the wallet, capitalized)       |
| Apache-2.0 | "Apache two point oh"                  |
| 0.50 USDG  | "fifty cents in U-S-D-G" or "zero point five oh U-S-D-G" |

## Colors

Copied from the `:root` tokens in `site/index.html`.

| Token          | Hex                                          | Use                                 |
| -------------- | -------------------------------------------- | ----------------------------------- |
| `--bg`         | `#050505`                                    | Every background                    |
| `--panel`      | `#0d0d0d`                                    | Cards, boxes, lower-third plates    |
| `--line`       | `#1c1c1e`                                    | Borders, dividers                   |
| `--fg`         | `#f5f5f5`                                    | Main text                           |
| `--muted`      | `#a0a0a5`                                    | Secondary text, labels              |
| `--dim`        | `#6a6a6f`                                    | Footers, fine print                 |
| `--violet`     | `#9945ff`                                    | Accent, gradient start              |
| `--aqua`       | `#8fa8c8`                                    | Kickers, small caps labels          |
| `--mint`       | `#14f195`                                    | "Approved", "done", gradient end    |
| `--amber`      | `#e8b45a`                                    | Warnings, "next", known risks       |
| `--red`        | `#f87171`                                    | "Rejected", kill buttons            |
| `--grad`       | `linear-gradient(90deg, #9945ff, #43b4ca, #14f195)` | One key phrase per frame, at most |

Use the gradient on one phrase per frame. Red only for rejections and the kill. Amber for anything
that is a risk or not live yet.

## Fonts

From the site's Google Fonts link:

- **Inter Tight** 700/800: headlines, numbers. Tight tracking (−0.03 em).
- **Inter** 400/500/600: narration captions, body text.
- **IBM Plex Mono** 400/500: kickers, code, commands, addresses, reject codes.

## Lower-thirds

- Plate: `#0d0d0d` at 90% opacity, 1 px `#1c1c1e` border, 16 px radius, 40 px from the left and
  bottom edges (above the caption zone on vertical).
- Line 1: Inter Tight 700, 34 px, `#f5f5f5`. Line 2: IBM Plex Mono 500, 22 px, `#8fa8c8`, uppercase.
- A 4 px gradient bar on the plate's left edge.
- In 0.25 s (slide right 20 px + fade), out 0.2 s (fade). On screen 3–5 s.
- Standard: `AgentGuard` / `OPEN SOURCE · SELF-HOSTED`. Never a person's name: the presenter is AI.

## Captions

- Burned in on every vertical video; uploaded as `.srt` on YouTube and X as well.
- Inter 600, 46 px on 1080×1920, `#f5f5f5`, 4 px black stroke at 60%, no box. Max 2 lines, 32
  characters per line, centered, bottom edge at 78% of frame height (above platform UI).
- Key words in `#14f195` (mint) or `#e8b45a` (amber for risks), one per caption at most.
- Numbers as digits: "20 a day", "0.50 USDG", "895 tests".
- Each script has an SRT block; copy it into `day-NN.srt` for upload.

## Visuals

- **Real first.** Use the rendered images in `assets/day-NN/`: site sections, the bot's real text,
  the signing page's real text, and branded cards. Re-render with
  `node marketing/videos/assets/src/render.cjs day-NN` from the repo root.
- **Long site shots** (taller than the frame) are meant for a slow vertical pan, top to bottom, at
  about 150 px per second on a 1080-wide frame.
- **AI-generated images** are illustrative only. Mark them in the edit with a small
  `Illustrative` tag (same style as the `AI presenter` label) and never show one as a screenshot of
  the product.
- **Never on screen:** private keys, seed phrases, agent or admin tokens, `.env` contents, API keys,
  RPC URLs with keys, Telegram bot tokens, real Telegram IDs. Addresses in our mock-ups are
  placeholders (`<your Safe>`, `<hot wallet>`). The pilot's public transaction hash may be shown
  shortened (`0xa9c7…3d86`).
- **Brand names** (Solana, Robinhood Chain, Phantom, Telegram, Squads, Safe, Fly.io, Vercel) appear
  as plain text only. No logos, no imitation of their interfaces as if endorsed. The chat mock-ups
  are a generic chat style, not a copy of Telegram's.
- The site's hero feed is labelled "simulated example" on the page. Keep that label visible when you
  show it.

## Motion and transitions

- Cuts on the beat by default. Allowed transitions: hard cut, 6-frame crossfade, a 10-frame push
  (up on vertical, left on horizontal). No spins, zooms over 110%, glitch or shake effects.
- Cards enter with a 0.3 s fade + 20 px rise. Lists reveal one item per spoken item.
- End card: 2 s, the CTA card, no presenter.

## Music

- Minimal electronic, warm pads with a soft pulse, 90–110 BPM, no vocals, no drops. Think "focused
  late-night build", not "launch hype".
- −24 LUFS under the voice (voice at −14 LUFS integrated). Duck 6 dB under narration.
- Royalty-free with a licence that allows commercial use on X, YouTube, Instagram and TikTok. Keep
  the licence file with the project.
- For risk and security-review videos, drop the pulse and keep only the pads.

## Formats

| Format                 | Size      | Length    | Where                       |
| ---------------------- | --------- | --------- | --------------------------- |
| Vertical short         | 1080×1920 | 30–75 s   | X, YouTube Shorts, Reels    |
| Horizontal explainer   | 1920×1080 | up to 3 min, one per week | YouTube, X        |
| Thumbnail, vertical    | 1080×1920 | —         | Shorts, Reels cover         |
| Thumbnail, horizontal  | 1920×1080 | —         | YouTube (export JPG < 2 MB) |

## Every video description

```
AI presenter. AgentGuard is open source (Apache-2.0) and self-hosted: there is no hosted service.
Early software: read the known risks in docs/final-report.md before you put money behind it.
Code: https://github.com/agent443-dot/AgentGuard
Self-host: https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md
Security reports, privately: https://github.com/agent443-dot/AgentGuard/security
```
