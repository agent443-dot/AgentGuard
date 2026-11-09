# HeyGen script — AgentGuard presentation (first video)

The 90-second presentation ([`presentation.md`](./presentation.md)), laid out for HeyGen: one HeyGen
scene per block, text ready to paste, written for text-to-speech (numbers and acronyms spelled the
way they should sound). Images are in `assets/day-05/`.

## Project settings

| Setting        | Value                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------- |
| Aspect ratio   | 16:9, 1080p                                                                                 |
| Avatar         | A professional stock or custom avatar, thirties, dark crew-neck or overshirt, no logos      |
| Avatar layout  | Left third of the frame, medium shot (waist up); images on the right two thirds             |
| Background     | Solid `#050505`, or `01-title.png` blurred, behind the avatar                               |
| Voice          | Neutral international English, calm and clear; male or female, the owner's choice           |
| Speed          | 1.0× (0.95× if it sounds rushed); target total about 1:30                                   |
| Captions       | On, white, Inter or the closest font available, bottom center                               |
| Music          | Minimal electronic pads, no vocals, low volume under the voice (see `style-guide.md`)       |
| Disclosure     | Small text "AI presenter" in the lower-left corner of scene 1; "AI presenter." first in the description |

Pauses: where the text says `[pause]`, add a short pause in HeyGen's script editor (about half a
second), or simply end the sentence there. Delete the `[pause]` marks before generating if you don't
add pauses.

## Scenes

### Scene 1 — Hook (0:00–0:05)

- **Image (right side):** `thumb.png`
- **Text overlay:** `AI presenter` (lower left, small)
- **Script:**

```
AI agents can pay for things now. [pause] AgentGuard makes sure they never hold the key.
```

### Scene 2 — What it is (0:05–0:15)

- **Image:** `02-site-hero.png`
- **Text overlay:** `Open source · Self-hosted`
- **Script:**

```
AgentGuard is an open-source guard that sits between your agent and your money. You run your own copy. There's no hosted service.
```

### Scene 3 — How a payment works (0:15–0:32)

- **Image:** `03-site-how.png`
- **Text overlay:** `Ask → Policy → Test run → Decide`
- **Script:**

```
When your agent wants to pay, an x four oh two API, or a transfer, it can only ask. [pause] AgentGuard checks your policy, test-runs the exact payment, and then approves it, sends it to you on Telegram, or rejects it.
```

### Scene 4 — Your approval (0:32–0:42)

- **Image:** `06-site-approval.png`
- **Text overlay:** `One yes = one payment`
- **Script:**

```
Above your threshold, you see the real effect on your phone. Not the agent's story. [pause] One yes, one payment.
```

### Scene 5 — The money and the daily cap (0:42–0:57)

- **Image:** `04-site-money.png`
- **Text overlay:** `Worst day = cap + hot wallet`
- **Script:**

```
Your money stays in a vault only your Phantom wallet controls. A spend limit built into Squads or Safe refills a small hot wallet, never above your daily cap. [pause] So your worst day is the cap, plus the hot wallet. Even if the guard is compromised.
```

### Scene 6 — The kill switch (0:57–1:05)

- **Image:** `05-site-security.png`
- **Text overlay:** `/kill + one Phantom signature`
- **Script:**

```
If anything looks wrong, slash kill pauses every agent. [pause] And one Phantom signature removes the onchain limit.
```

### Scene 7 — Where it runs (1:05–1:15)

- **Image:** `07-site-chains.png`
- **Text overlay:** `Robinhood Chain: live · Solana: next · Base: later`
- **Script:**

```
It's live on Robinhood Chain mainnet, after a real-money pilot. Solana is next, and Base comes later. [pause] Eight hundred and ninety-five automated tests, and thirty-nine attack cases.
```

Only if Solana mainnet is confirmed live before you generate: replace the first two sentences with
"It's live on Robinhood Chain and Solana mainnet, after a real-money pilot. Base comes later." and
the overlay with `Robinhood Chain · Solana: live · Base: later`.

### Scene 8 — Honest about risk (1:15–1:25)

- **Image:** `09-risks.png`
- **Text overlay:** `Known risks: docs/final-report.md`
- **Script:**

```
It's early. [pause] And the known risks are written down in the repo, right next to the code.
```

### Scene 9 — Call to action (1:25–1:32)

- **Image:** `10-cta.png`, full frame (hide the avatar or make it small)
- **Text overlay:** `github.com/agent443-dot/AgentGuard`
- **Script:**

```
Run your own, connect your agent through M C P, and if you find a hole, report it privately.
```

## Full script in one block

For HeyGen's single-scene mode or to paste into the voice preview. About 225 words, about 1:30.

```
AI agents can pay for things now. AgentGuard makes sure they never hold the key.

AgentGuard is an open-source guard that sits between your agent and your money. You run your own copy. There's no hosted service.

When your agent wants to pay, an x four oh two API, or a transfer, it can only ask. AgentGuard checks your policy, test-runs the exact payment, and then approves it, sends it to you on Telegram, or rejects it.

Above your threshold, you see the real effect on your phone. Not the agent's story. One yes, one payment.

Your money stays in a vault only your Phantom wallet controls. A spend limit built into Squads or Safe refills a small hot wallet, never above your daily cap. So your worst day is the cap, plus the hot wallet. Even if the guard is compromised.

If anything looks wrong, slash kill pauses every agent. And one Phantom signature removes the onchain limit.

It's live on Robinhood Chain mainnet, after a real-money pilot. Solana is next, and Base comes later. Eight hundred and ninety-five automated tests, and thirty-nine attack cases.

It's early. And the known risks are written down in the repo, right next to the code.

Run your own, connect your agent through M C P, and if you find a hole, report it privately.
```

## Before you export

- Listen once for "x four oh two", "M C P" and "Squads"; if the voice still mispronounces one, spell it
  differently in that scene only.
- Check the "AI presenter" label is on scene 1 and the description starts with "AI presenter."
- No key, token, `.env` or real address appears in any image: the images in `assets/day-05/` are
  checked for that; don't add screenshots from your own wallet or terminal.
- Description, thumbnail and X post: use the ones in [`presentation.md`](./presentation.md).
