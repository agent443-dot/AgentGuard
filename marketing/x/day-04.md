# Day 04 · Thursday 2026-11-12 · The test run before signing

Theme: simulation and the twenty reject codes.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/SPEC.md`

---

## 13:30 UTC · 10:30 BRT · Video · P1

```text
[VIDEO DAY 04]

Before AgentGuard signs anything, it rehearses the exact payment and looks at what it would really do, not what the agent says it does.
```

Caption for the video session: "The simulation step: exact balance changes, hidden permissions,
programs you never approved."

---

## 15:00 UTC · 12:00 BRT · Thread: twenty ways to say no · P4

**1/7** · Image: `assets/day-04/01-reject-codes.png`

```text
AgentGuard has twenty named ways to refuse a payment.

Each refusal carries its code, so you, your agent and the audit log all know exactly why. Here is what they catch. 🧵
```

Alt text: Code card titled "Twenty ways to say no. Each one has a name." It lists reject codes from the
spec. Shared: PAUSED, CHAIN_NOT_ALLOWED, TOKEN_NOT_ALLOWED, RECIPIENT_NOT_ALLOWED, DOMAIN_NOT_ALLOWED,
PER_TX_EXCEEDED, DAILY_EXCEEDED, SIM_FAILED, SIM_UNEXPECTED_EFFECT, OWNER_REJECTED, APPROVAL_TIMEOUT,
INVALID_402. EVM: APPROVAL_DETECTED, PERMIT_DETECTED, DELEGATION_DETECTED. Solana: DELEGATE_DETECTED,
AUTHORITY_CHANGE_DETECTED, ACCOUNT_CLOSE_DETECTED, UNKNOWN_PROGRAM_DETECTED, HIDDEN_ACCOUNTS_DETECTED.

**2/7**

```text
Policy first. A new agent denies everything.

PAUSED, CHAIN_NOT_ALLOWED, TOKEN_NOT_ALLOWED, RECIPIENT_NOT_ALLOWED, DOMAIN_NOT_ALLOWED, PER_TX_EXCEEDED, DAILY_EXCEEDED.

Any doubt means no.
```

**3/7**

```text
Then the simulation. SIM_FAILED if the exact transfer would not go through. SIM_UNEXPECTED_EFFECT if it would do anything beyond moving that amount to that recipient.

On EVM, both balances must move by exactly the amount.
```

**4/7**

```text
EVM-specific: the hot wallet signs only TransferWithAuthorization, after every field is checked.

Anything else is refused: APPROVAL_DETECTED (approve, setApprovalForAll), PERMIT_DETECTED (Permit, Permit2), DELEGATION_DETECTED (EIP-7702).
```

**5/7**

```text
Solana-specific: DELEGATE_DETECTED (SPL Approve), AUTHORITY_CHANGE_DETECTED (SetAuthority), ACCOUNT_CLOSE_DETECTED (CloseAccount), UNKNOWN_PROGRAM_DETECTED, and HIDDEN_ACCOUNTS_DETECTED for lookup tables that obscure touched accounts.
```

**6/7** · Image: `assets/day-04/02-site-threats.png`

```text
And the human ones: OWNER_REJECTED when you say no on Telegram, APPROVAL_TIMEOUT when you say nothing. No answer means no payment.

INVALID_402 when a paid API's payment request is malformed.
```

Alt text: Screenshot of the AgentGuard website section "What gets blocked: Twenty ways to say no", with
tabs for Policy, Solana and EVM and cards describing each refusal.

**7/7**

```text
The full list, with the types and the API, is in the spec. 39 attack cases in the test suite exercise these paths.

https://github.com/agent443-dot/AgentGuard/blob/main/SPEC.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
If you pointed your current agent at AgentGuard with a deny-all policy, which reject code would it hit first?

My guess for most setups: DOMAIN_NOT_ALLOWED within the first minute.
```

---

## Reply bank for Day 4

**"Can a simulation be fooled?"**

```text
A simulation shows what the exact transaction would do against current state. It is one layer, not the only one: the policy runs before it, and the onchain cap bounds the day whatever happens after.
```

**"Which RPC do you simulate with?"**

```text
Yours. You configure the RPC for each chain. On EVM we use eth_simulateV1, and CI probes that the public Base Sepolia RPC supports it.
```

**"Why only TransferWithAuthorization on EVM?"**

```text
It is the narrowest thing that pays an x402 API: one amount, one recipient, a short validity window. What gets signed is rebuilt from the checked values, never passed through from the request.
```

**"What if a legit API needs an approve?"**

```text
Then AgentGuard will refuse it with APPROVAL_DETECTED. That is deliberate: an approval outlives the payment. We would rather lose that API than sign one.
```
