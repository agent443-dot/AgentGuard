# Day 12 · Friday 2026-11-20 · The signing page is a trust root

Theme: why you deploy your own signing page, and how it is locked down.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md`

---

## 13:30 UTC · 10:30 BRT · Video · P4

```text
[VIDEO DAY 12]

You sign your vault's setup and its kill in Phantom, on a static page. Whoever can change that page can show you a harmless summary of a harmful transaction. So you deploy your own.
```

Caption for the video session: "The signing page: why it is yours and how it is locked down."

---

## 16:00 UTC · 13:00 BRT · Technical · P4

Image: `assets/day-12/01-signing-page.png`

```text
Known risk #3: the signing page is a trust root.

So each user deploys their own, from their own protected main:
• builds main only, previews off
• strict Content-Security-Policy, no third-party scripts at runtime
• hot wallet addresses built in; a link cannot change them
```

Alt text: Card titled "The signing page is a trust root." Rows: Why, whoever redeploys it can show a
harmless summary of a harmful transaction. Yours, each user deploys their own, from their own
protected main. Locked, builds main only, previews off, strict Content-Security-Policy. Fixed, your hot
wallet addresses are built in, a link cannot change them. Checked, each result is read back from the
chain.

Reply to self:

```text
Why previews off: a preview build of a PR branch would be an unreviewed signing page on a public URL.

After you deploy, check the page names your hot wallets:
curl -s https://<your page>/app.js | grep -o 'hot:"[^"]*"'
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
Where do you sign your most sensitive transactions?

A hardware wallet, a mobile wallet, a browser extension, a multisig app?

We launched with a software-wallet owner on purpose and wrote down the conditions. Curious what others accept.
```

---

## Reply bank for Day 12

**"Why not just use the Squads or Safe app?"**

```text
We have not tested the Squads app as a setup path; those checks in ADR 003 were skipped. Our page has your hot wallet addresses built in and reads each result back from the chain.
```

**"What does Phantom show me when I sign the kill?"**

```text
We checked on devnet what Phantom shows for the Solana limit removal (ADR 003, check 4). Always compare the addresses with your own status output before you sign.
```

**"What's the Solana kill page issue still open?"**

```text
It trusts the multisig from the link, so a decoy multisig you control would read "Already killed". Low severity, listed as open. Compare the address with pnpm status.
```
