# Day 23 · Tuesday 2026-12-01 · Rate limits behind a proxy

Theme: known risk #4, and the forged-header test on Fly.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md`

---

## 13:30 UTC · 10:30 BRT · Video · P4

```text
[VIDEO DAY 23]

Rate limits are only as good as the address they count. AgentGuard counts the socket address, never X-Forwarded-For. Here is why, and what that means behind a proxy.
```

Caption for the video session: "Rate limits, forged headers, and known risk #4."

---

## 15:00 UTC · 12:00 BRT · Thread · P4

**1/5** · Image: `assets/day-23/01-rate-limit.png`

```text
We sent 130 requests to our deployed guard in about a minute, each with a different forged client IP. It still answered 429. Here is the test, and the risk it doesn't remove. 🧵
```

Alt text: Card titled "130 requests, forged client IPs. Still 429." Rows: Test, about a minute, each
request with a different Fly-Client-IP and X-Forwarded-For. Result, still rate limited, Fly replaces
the header with the real address. Rule, guard-core counts per socket address, never X-Forwarded-For.
Risk #4, behind your own proxy, add a per-client limit there.

**2/5**

```text
Each request carried a different Fly-Client-IP and X-Forwarded-For. Had the guard trusted the header, every forged address would have looked like one request, and nothing would have been limited.

Fly replaces that header with the real client address.
```

**3/5**

```text
guard-core, the bot's hooks and the MCP HTTP endpoint each have a limit, and all three count the socket address. The agent routes also limit per token, checked before the token is looked up.
```

**4/5**

```text
The catch, known risk #4: behind a proxy, every client shares the proxy's address, so they share one limit.

If you put your own proxy in front, give it its own per-client limit.
```

**5/5**

```text
The deployment review, with this test and the rest:

https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
Do you trust X-Forwarded-For anywhere in your stack?

It is one of the easiest headers to forge, and one of the most trusted by default.
```

---

## Reply bank for Day 23

**"What are the default limits?"**

```text
guard-core: 120 requests a minute per address and 60 per agent token. Bot hooks: 300 a minute. MCP HTTP: 60 a minute. All configurable.
```

**"Is this a DoS defense?"**

```text
No. Denial of service by volume is out of scope in SECURITY.md. The limits stop one client from hammering the API, not a flood.
```
