# Voice-over launch video — "Pocket money, not your keys"

| Field         | Value                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Goal          | A cinematic, no-avatar first video anyone understands: robots with wallets, and the guard |
| Target viewer | Everyone: crypto people, AI people, people who are neither                                |
| Format        | 16:9 1920×1080 master; vertical 9:16 cut from the same edit (keep subjects centered)      |
| Length        | about 1:30                                                                                |
| Presenter     | None. Voice-over only, over futuristic visuals and real product screens                   |
| Status        | ready to produce                                                                          |

Explained like it's for a five-year-old: the AI agent is a **robot helper**, the vault is a **piggy
bank**, the onchain daily cap is a **lock that lets out only a little each day**, the simulation is a
**practice world**, `/kill` is **one big button**. Every metaphor maps to a real feature (fact check
at the end). Energetic and cinematic, never hype: no "unhackable", no "guaranteed", no price or
investment talk, nothing about any token.

## Voice

- **Voice:** deep, warm, cinematic narrator; English, neutral international accent. Calm power, not a
  shouting trailer voice. Works with ElevenLabs, HeyGen voice-only, or any good TTS.
- **Delivery:** slow and confident in the setup (scenes 1–3), lifts in energy from "So we built
  AgentGuard", quiet and close for "It's new…", big and slow on the last line.
- **Pauses:** `…` is a breath (about 0.4 s); `[beat]` is a full stop of about 1 s. In tools that support
  it, a beat can be `<break time="1s"/>`.
- Spelled for TTS: "slash kill", "Robinhood Chain".

## Script to paste (voice only)

```
Imagine a robot… that can buy things for you.

It buys data. It pays for tools. All day. All night. In seconds.

But here's the question nobody wants to ask. [beat]
Would you give a robot… the key to your piggy bank?

Neither would we. [beat]

So we built AgentGuard.

The robot never gets the key. Ever. It can only ask.

Every time it asks, AgentGuard checks your rules. Is this a shop you trust? Is it too much?

Then it plays the payment in a practice world first… to see what it would really do.

Small, and inside your rules? Done. Big? Your phone lights up. You say yes. Or no.

And your piggy bank? It has a lock built right into the blockchain. Only a little can come out each day. Even if someone breaks AgentGuard itself… the lock holds.

Something feels wrong? One button. Slash kill. Every robot stops. One signature… and the door is shut.

No company in the middle. You run your own. Open source. Every line, in the open.

Live today, on Robinhood Chain. Solana is next.

It's new. And every known risk is written down… right next to the code. [beat]

Robots are getting wallets.
Give them pocket money. Not your keys. [beat]

AgentGuard.
```

About 230 words. At a cinematic pace with the beats, about 1:30.

## Scenes

Visual style for every AI-generated shot (paste before each prompt): *"Cinematic 3D render, near-black
background (#050505), soft violet rim light (#9945ff) and mint accents (#14f195), clean futuristic
minimalism, glassy surfaces, volumetric light, shallow depth of field, smooth slow camera move, no
text, no logos, no coins with symbols, no real brands."* Mark every AI shot `Illustrative` in a small
corner label (see `style-guide.md`). Real product screens come from `assets/`.

| #   | Time      | Voice-over                                                                                   | Visual                                                                                                                                       | On-screen text                 | Sound                          |
| --- | --------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| 1   | 0:00–0:08 | Imagine a robot… that can buy things for you. It buys data. It pays for tools. All day. All night. In seconds. | **AI:** a small friendly robot made of matte graphite and glowing violet seams, in a dark void, tapping floating glass panels; tiny streams of light fly from it to distant glowing doors | —                   | Low hum, then a soft pulse     |
| 2   | 0:08–0:17 | But here's the question nobody wants to ask. Would you give a robot… the key to your piggy bank? | **AI:** slow push-in on the robot's hand reaching toward a glowing translucent glass piggy bank, a single light-key hovering in front of it | `Would you?`                   | Music drops out; one heartbeat |
| 3   | 0:17–0:21 | Neither would we. So we built AgentGuard.                                                    | Hard cut to black, then `assets/day-05/thumb.png` reveals with a light sweep                                                                 | `AgentGuard`                   | Soft impact, music returns fuller |
| 4   | 0:21–0:26 | The robot never gets the key. Ever. It can only ask.                                          | **AI:** the light-key dissolves into particles; the robot now holds a small glowing card that says nothing, raised like a question            | `It can only ask.`             | Whoosh                         |
| 5   | 0:26–0:34 | Every time it asks, AgentGuard checks your rules. Is this a shop you trust? Is it too much?   | Real screen: `assets/day-05/03-site-how.png`, slow pan from Step 1 to Step 2                                                                 | `Your rules.`                  | Two soft clicks on the questions |
| 6   | 0:34–0:40 | Then it plays the payment in a practice world first… to see what it would really do.          | **AI:** a translucent holographic copy of the payment runs inside a wireframe glass cube; a mint check-mark scan passes over it              | `Practice run first.`          | Rising shimmer                 |
| 7   | 0:40–0:48 | Small, and inside your rules? Done. Big? Your phone lights up. You say yes. Or no.            | Real screen: `assets/day-05/06-site-approval.png`, the "Approve" button pulses once                                                          | `Big payment? You decide.`     | Notification tone (generic)    |
| 8   | 0:48–0:59 | And your piggy bank? It has a lock built right into the blockchain. Only a little can come out each day. Even if someone breaks AgentGuard itself… the lock holds. | **AI:** the glass piggy bank wrapped in rotating rings of light; a thin, measured stream of light leaves it; a cracked shield nearby while the rings stay intact. Then real: `assets/day-05/04-site-money.png` (2 s) | `A daily lock, onchain.` | Deep, steady bass hum |
| 9   | 0:59–1:07 | Something feels wrong? One button. Slash kill. Every robot stops. One signature… and the door is shut. | **AI:** a large glowing red button pressed in slow motion; every robot in a wide shot freezes mid-step; a vault door closes with a light seal. Then real: `assets/day-04/03-chat-engaged.png` (1.5 s) | `/kill`        | Silence on the press, then a heavy door close |
| 10  | 1:07–1:15 | No company in the middle. You run your own. Open source. Every line, in the open.             | **AI:** camera flies through an endless corridor of floating, glowing lines of abstract code (unreadable glyphs); cut to `assets/day-05/08-site-developers.png` | `Open source. Self-hosted.` | Music builds          |
| 11  | 1:15–1:19 | Live today, on Robinhood Chain. Solana is next.                                               | Real screen: `assets/day-05/07-site-chains.png`                                                                                              | `Live: Robinhood Chain · Next: Solana` | Music at its fullest |
| 12  | 1:19–1:24 | It's new. And every known risk is written down… right next to the code.                       | Real screen: `assets/day-05/09-risks.png`, held still                                                                                        | `Known risks, in the open.`    | Music pulls back to pads       |
| 13  | 1:24–1:30 | Robots are getting wallets. Give them pocket money. Not your keys. AgentGuard.                | **AI:** the robot from scene 1 walks into the light holding a small glowing card of light (pocket money), no coin, no symbol; fade to `assets/day-05/10-cta.png` | `Pocket money. Not your keys.` then `github.com/agent443-dot/AgentGuard` | Final soft hit, ring out |

**Solana swap (scene 11), only once Solana mainnet is confirmed live:** "Live today, on Robinhood
Chain and Solana." Overlay: `Live: Robinhood Chain · Solana`.

Nothing in this video should look like a coin or a token: if a render shows one, regenerate it.

## Vertical cut (9:16)

Same voice track. Reframe the AI shots to center the robot and the piggy bank; use the vertical
product images instead: `day-02/03-site-how.png` (pan), `day-03/03-site-calculator.png`,
`day-04/02-chat-kill.png`, `day-01/06-status.png`, `day-01/07-cta.png`. Captions burned in.

## Music and sound

Futuristic, cinematic, minimal: dark synth pads, a slow pulse at about 90 BPM that builds from scene 3
to scene 11, then pulls back for scene 12 and swells on the last line. No vocals, no EDM drop.
Royalty-free with a commercial licence. Voice at −14 LUFS, music ducked about 6 dB under it.

## Captions (SRT)

```srt
1
00:00:00,000 --> 00:00:04,000
Imagine a robot…
that can buy things for you.

2
00:00:04,000 --> 00:00:08,000
It buys data. It pays for tools.
All day. All night. In seconds.

3
00:00:08,000 --> 00:00:12,000
But here's the question
nobody wants to ask.

4
00:00:12,000 --> 00:00:17,000
Would you give a robot
the key to your piggy bank?

5
00:00:17,000 --> 00:00:21,000
Neither would we.
So we built AgentGuard.

6
00:00:21,000 --> 00:00:26,000
The robot never gets the key.
Ever. It can only ask.

7
00:00:26,000 --> 00:00:34,000
AgentGuard checks your rules. A shop
you trust? Too much?

8
00:00:34,000 --> 00:00:40,000
Then it plays the payment in a
practice world first.

9
00:00:40,000 --> 00:00:48,000
Small? Done. Big? Your phone lights up.
You say yes. Or no.

10
00:00:48,000 --> 00:00:54,000
Your piggy bank has a lock built
into the blockchain.

11
00:00:54,000 --> 00:00:59,000
Only a little comes out each day.
Even if AgentGuard breaks, it holds.

12
00:00:59,000 --> 00:01:07,000
One button: /kill. Every robot stops.
One signature, and the door is shut.

13
00:01:07,000 --> 00:01:15,000
No company in the middle. You run
your own. Open source.

14
00:01:15,000 --> 00:01:19,000
Live today on Robinhood Chain.
Solana is next.

15
00:01:19,000 --> 00:01:24,000
It's new. Every known risk is
written down, next to the code.

16
00:01:24,000 --> 00:01:30,000
Give robots pocket money.
Not your keys. AgentGuard.
```

## Description

```
AI-generated visuals and AI voice. AgentGuard is open source (Apache-2.0) and self-hosted: there is no hosted service.
Early software: read the known risks in docs/final-report.md before you put money behind it.
Code: https://github.com/agent443-dot/AgentGuard
Self-host: https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md
Security reports, privately: https://github.com/agent443-dot/AgentGuard/security
```

## X post

```
Robots are getting wallets.

AgentGuard gives your AI agent pocket money, never your keys: your rules, a practice run of every payment, your yes on big ones, a daily lock enforced onchain, and one button to stop it all.

Open source. Live on Robinhood Chain.
https://github.com/agent443-dot/AgentGuard
```

## Fact check: every metaphor is a real feature

| Line                                                  | What it really is                                                     | Source                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| "a robot that can buy things… pays for tools"         | AI agents paying x402 APIs and transfers                              | `README.md`, `site/index.html` FAQ                  |
| "never gets the key… can only ask"                    | The agent holds no key; guard-core signs after the checks             | `README.md`                                         |
| "checks your rules… a shop you trust? too much?"      | Policy: allowlisted domains/recipients, per-payment and daily limits  | `SPEC.md` Policy, `docs/final-report.md`            |
| "plays the payment in a practice world first"         | Simulation of the exact payment before signing                        | `SPEC.md` Goal, `site/index.html` Step 3            |
| "Big? Your phone lights up. Yes or no."               | Telegram approval at or above the owner's threshold                   | `SPEC.md`, `site/index.html`                        |
| "a lock built into the blockchain… a little each day" | The onchain daily cap: Squads spending limit / Safe Allowance Module  | `README.md`                                         |
| "Even if someone breaks AgentGuard… the lock holds"   | Worst day = cap + hot wallet balance, even if guard-core is compromised | `docs/self-host.md`, `SECURITY.md`                |
| "One button… every robot stops… one signature"        | `/kill` pauses every agent; one Phantom signature removes the limit   | `docs/self-host.md`, `LAUNCH.md` §4                 |
| "No company in the middle. You run your own."         | Self-hosted, no hosted service, Apache-2.0                            | `LAUNCH.md` D7, D8                                  |
| "Live today on Robinhood Chain. Solana is next."      | Launch chain and order                                                | `README.md`, `LAUNCH.md` D6                         |
| "every known risk is written down"                    | Known risks section                                                   | `docs/final-report.md`                              |
