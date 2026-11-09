# Semana 4: dias 22 a 28

Copie o bloco em inglês e cole no X. A tradução em português fica logo abaixo, só para você saber o que está postando.

## Dia 22 · segunda-feira, 30/11/2026 · Backups e o teste de restauração

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 22]

guard-core keeps your policies, today's spend and the audit log. Before launch we backed it up, restored it elsewhere, and checked it against the live guard.
```

> 🇧🇷 [VIDEO DAY 22]
>
> O guard-core guarda suas políticas, o gasto do dia e o log de auditoria. Antes do lançamento, fizemos um backup, restauramos em outro lugar e conferimos com o guard em produção.

### 13:00 BRT (16:00 UTC) · Bastidores

```text
Our restore drill, before launch:

1. db:backup on the Fly machine
2. copied off with fly ssh sftp get
3. restore-drill opened it with the current code and migrations

Policy, today's spend, both executed intents and all 15 audit events matched the live guard.
```

> 🇧🇷 Nosso teste de restauração, antes do lançamento:
>
> 1. db:backup na máquina do Fly
> 2. cópia para fora com fly ssh sftp get
> 3. o restore-drill abriu o arquivo com o código e as migrations atuais
>
> A política, o gasto do dia, as duas intents executadas e os 15 eventos de auditoria bateram com o guard em produção.

### 13:00 BRT (16:00 UTC) · Bastidores · resposta ao seu próprio post

```text
Still open, and listed as known risk #5: a backup schedule that copies the database off the volume. Fly snapshots it daily; a copy elsewhere is the next step.

Run your own drill: self-host guide, step 7.
https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md
```

> 🇧🇷 Ainda em aberto, e listado como risco conhecido nº 5: uma rotina de backup que copie o banco de dados para fora do volume. O Fly tira um snapshot por dia; uma cópia em outro lugar é o próximo passo.
>
> Faça o seu próprio teste: guia de self-host, passo 7.
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md

### 17:00 BRT (20:00 UTC) · Conversa

```text
When did you last restore a backup, not just take one?

For anything that tracks money, we now count a backup as real only after a restore drill.
```

> 🇧🇷 Quando foi a última vez que você restaurou um backup, e não só fez um?
>
> Para qualquer coisa que controla dinheiro, agora só consideramos um backup real depois de um teste de restauração.

## Dia 23 · terça-feira, 01/12/2026 · Limites de requisição atrás de um proxy

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 23]

Rate limits are only as good as the address they count. AgentGuard counts the socket address, never X-Forwarded-For. Here is why, and what that means behind a proxy.
```

> 🇧🇷 [VIDEO DAY 23]
>
> Um limite de requisições só é tão bom quanto o endereço que ele conta. O AgentGuard conta o endereço do socket, nunca o X-Forwarded-For. Veja o porquê, e o que isso significa atrás de um proxy.

### 12:00 BRT (15:00 UTC) · Thread · 1/5

```text
We sent 130 requests to our deployed guard in about a minute, each with a different forged client IP. It still answered 429. Here is the test, and the risk it doesn't remove. 🧵
```

> 🇧🇷 Mandamos 130 requisições ao nosso guard em produção em cerca de um minuto, cada uma com um IP de cliente falsificado diferente. Ele ainda respondeu 429. Aqui está o teste, e o risco que ele não elimina. 🧵

### 12:00 BRT (15:00 UTC) · Thread · 2/5

```text
Each request carried a different Fly-Client-IP and X-Forwarded-For. Had the guard trusted the header, every forged address would have looked like one request, and nothing would have been limited.

Fly replaces that header with the real client address.
```

> 🇧🇷 Cada requisição levava um Fly-Client-IP e um X-Forwarded-For diferentes. Se o guard confiasse no header, cada endereço falso pareceria uma única requisição, e nada teria sido limitado.
>
> O Fly substitui esse header pelo endereço real do cliente.

### 12:00 BRT (15:00 UTC) · Thread · 3/5

```text
guard-core, the bot's hooks and the MCP HTTP endpoint each have a limit, and all three count the socket address. The agent routes also limit per token, checked before the token is looked up.
```

> 🇧🇷 O guard-core, os hooks do bot e o endpoint HTTP do MCP têm cada um o seu limite, e os três contam o endereço do socket. As rotas do agente também limitam por token, verificado antes de o token ser consultado.

### 12:00 BRT (15:00 UTC) · Thread · 4/5

```text
The catch, known risk #4: behind a proxy, every client shares the proxy's address, so they share one limit.

If you put your own proxy in front, give it its own per-client limit.
```

> 🇧🇷 O porém, risco conhecido nº 4: atrás de um proxy, todos os clientes compartilham o endereço do proxy, então compartilham um único limite.
>
> Se você colocar seu próprio proxy na frente, dê a ele um limite próprio por cliente.

### 12:00 BRT (15:00 UTC) · Thread · 5/5

```text
The deployment review, with this test and the rest:

https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

> 🇧🇷 A revisão do deploy, com este teste e os demais:
>
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md

### 17:00 BRT (20:00 UTC) · Conversa

```text
Do you trust X-Forwarded-For anywhere in your stack?

It is one of the easiest headers to forge, and one of the most trusted by default.
```

> 🇧🇷 Você confia no X-Forwarded-For em algum lugar da sua stack?
>
> É um dos headers mais fáceis de falsificar, e um dos que mais recebem confiança por padrão.

## Dia 24 · quarta-feira, 02/12/2026 · A chave do dono

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 24]

The owner key controls the whole vault. We launched with it in Phantom, a software wallet, on purpose and with conditions. This is the trade-off, stated plainly.
```

> 🇧🇷 [VIDEO DAY 24]
>
> A chave do dono controla o cofre inteiro. Lançamos com ela no Phantom, uma carteira de software, de propósito e com condições. Esta é a troca, dita com clareza.

### 13:00 BRT (16:00 UTC) · Técnico

```text
AgentGuard's owner key is in a software wallet (known risk #2). It can move the whole vault, so three conditions are mandatory:

1. a fresh recovery phrase, for it alone
2. used for nothing else
3. a vault holding only what agents need for the coming days
```

> 🇧🇷 A chave do dono no AgentGuard fica numa carteira de software (risco conhecido nº 2). Ela pode mover o cofre inteiro, então três condições são obrigatórias:
>
> 1. uma frase de recuperação nova, só para ela
> 2. não usada para mais nada
> 3. um cofre com apenas o que os agentes precisam para os próximos dias

### 13:00 BRT (16:00 UTC) · Técnico · resposta ao seu próprio post

```text
Not "a new account in your existing Phantom": that shares the wallet's phrase. A new wallet, a new phrase.

There is a Ledger path in the scripts, proven only against a fake device so far. Real hardware is an open item.
```

> 🇧🇷 Não é "uma conta nova no seu Phantom atual": isso compartilha a frase da carteira. Uma carteira nova, uma frase nova.
>
> Existe um caminho com Ledger nos scripts, testado até agora só contra um dispositivo simulado. O teste com hardware real está em aberto.

### 17:00 BRT (20:00 UTC) · Conversa

```text
Hardware wallet or software wallet for an owner key that can move a small vault?

We chose software for launch, with a small vault and a dedicated phrase. Tell us where you'd draw the line.
```

> 🇧🇷 Carteira de hardware ou de software para uma chave de dono que pode mover um cofre pequeno?
>
> Escolhemos software para o lançamento, com um cofre pequeno e uma frase dedicada. Diga onde você traçaria o limite.

## Dia 25 · quinta-feira, 03/12/2026 · A vida de um pagamento

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 25]

One payment, from the agent's request to the receipt: 0.50 USDG on Robinhood Chain mainnet, through every step AgentGuard has.
```

> 🇧🇷 [VIDEO DAY 25]
>
> Um pagamento, do pedido do agente ao comprovante: 0,50 USDG na mainnet da Robinhood Chain, passando por todas as etapas do AgentGuard.

### 12:00 BRT (15:00 UTC) · Thread · 1/7

```text
The life of one real AgentGuard payment: intent 9a594294 on Robinhood Chain mainnet, 0.50 USDG over x402. 🧵
```

> 🇧🇷 A vida de um pagamento real no AgentGuard: intent 9a594294 na mainnet da Robinhood Chain, 0,50 USDG via x402. 🧵

### 12:00 BRT (15:00 UTC) · Thread · 2/7

```text
The setup: a Safe owned by a fresh Phantom wallet alone, holding 4.914759 USDG. The Allowance Module on, with the hot wallet as delegate: 5 USDG per 1440 minutes, 0 spent.
```

> 🇧🇷 A configuração: um Safe cujo único dono é uma carteira Phantom nova, com 4,914759 USDG. O Allowance Module ativado, com a hot wallet como delegada: 5 USDG a cada 1440 minutos, 0 gasto.

### 12:00 BRT (15:00 UTC) · Thread · 3/7

```text
The policy: chain eip155:4663, token USDG, 1 per payment, 5 a day, one allowed domain.

The agent called paid_fetch on that domain. The API answered 402.
```

> 🇧🇷 A política: rede eip155:4663, token USDG, 1 por pagamento, 5 por dia, um domínio permitido.
>
> O agente chamou paid_fetch nesse domínio. A API respondeu 402.

### 12:00 BRT (15:00 UTC) · Thread · 4/7

```text
guard-core checked the terms against the policy and simulated the transfer. 0.50 was under the threshold, so it was auto-approved.

The hot wallet signed one EIP-3009 authorization. The paywall verified it and settled it itself, paying the gas.
```

> 🇧🇷 O guard-core conferiu os termos com a política e simulou a transferência. 0,50 estava abaixo do limite de aprovação, então foi aprovado automaticamente.
>
> A hot wallet assinou uma autorização EIP-3009. O paywall a verificou e liquidou ele mesmo, pagando o gás.

### 12:00 BRT (15:00 UTC) · Thread · 5/7

```text
Read back from the chain afterwards:

• the Safe: 4.414759 USDG
• the allowance: 500000 spent (0.50)
• the hot wallet: 0 USDG
```

> 🇧🇷 Lido de volta na blockchain depois:
>
> • o Safe: 4,414759 USDG
> • a allowance: 500000 gastos (0,50)
> • a hot wallet: 0 USDG

### 12:00 BRT (15:00 UTC) · Thread · 6/7

```text
Then the kill: /kill → Confirm paused the agent. The owner signed removeDelegate in Phantom, and the page read back "no longer a delegate".
```

> 🇧🇷 Depois, o kill: /kill → Confirm pausou o agente. O dono assinou o removeDelegate no Phantom, e a página leu de volta "no longer a delegate" (não é mais delegada).

### 12:00 BRT (15:00 UTC) · Thread · 7/7

```text
Every step, with the transaction hash:

https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

> 🇧🇷 Cada etapa, com o hash da transação:
>
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md

### 17:00 BRT (20:00 UTC) · Conversa

```text
What would you want logged for every payment an agent makes?

Ours: the request, the policy decision and its reasons, the simulation, the approval if any, and the transaction. What are we missing?
```

> 🇧🇷 O que você gostaria de ver registrado em cada pagamento que um agente faz?
>
> O nosso: o pedido, a decisão da política e seus motivos, a simulação, a aprovação se houver, e a transação. O que está faltando?

## Dia 26 · sexta-feira, 04/12/2026 · Como reportar uma vulnerabilidade

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 26]

AgentGuard sits between agents and money, so security reports are the most important issues we get. If you break something, here is how to tell us without telling everyone.
```

> 🇧🇷 [VIDEO DAY 26]
>
> O AgentGuard fica entre agentes e dinheiro, então relatos de segurança são as issues mais importantes que recebemos. Se você quebrar algo, veja como nos contar sem contar para todo mundo.

### 13:00 BRT (16:00 UTC) · Técnico

```text
Found a way to move funds, bypass a policy, expose a key or defeat the kill switch in AgentGuard?

Report it privately: Security → Report a vulnerability on the repo.
• an answer within 72 hours
• 90 days before publishing, or until a fix ships
• credit if you want it
```

> 🇧🇷 Encontrou um jeito de mover fundos, contornar uma política, expor uma chave ou derrotar o kill switch no AgentGuard?
>
> Reporte em privado: Security → Report a vulnerability no repositório.
> • uma resposta em até 72 horas
> • 90 dias antes de publicar, ou até sair a correção
> • crédito, se você quiser

### 13:00 BRT (16:00 UTC) · Técnico · resposta ao seu próprio post

```text
No paid bug bounty yet, and we won't pretend otherwise. In scope: everything in the repo. Out of scope: Squads, Safe and the Allowance Module themselves, an attacker who has the owner's wallet, and DoS by volume.

https://github.com/agent443-dot/AgentGuard/blob/main/SECURITY.md
```

> 🇧🇷 Ainda não há bug bounty pago, e não vamos fingir o contrário. Dentro do escopo: tudo no repositório. Fora do escopo: o próprio Squads, o Safe e o Allowance Module, um atacante que já tem a carteira do dono, e DoS por volume.
>
> https://github.com/agent443-dot/AgentGuard/blob/main/SECURITY.md

### 17:00 BRT (20:00 UTC) · Conversa

```text
If you were reviewing AgentGuard for an afternoon, where would you start?

The signing page, the x402 retry, the Solana transaction inspection, the bot's hooks? We'd like to know where outside eyes go first.
```

> 🇧🇷 Se você fosse revisar o AgentGuard por uma tarde, por onde começaria?
>
> A página de assinatura, o retry do x402, a inspeção de transações na Solana, os hooks do bot? Queremos saber para onde olhos de fora vão primeiro.

## Dia 27 · sábado, 05/12/2026 · Base, onde está

### 12:00 BRT (15:00 UTC) · Vídeo

```text
[VIDEO DAY 27]

Base is on the roadmap after Solana. It is tested, but it is not live, and here is exactly what is left before it is.
```

> 🇧🇷 [VIDEO DAY 27]
>
> A Base está no roadmap depois da Solana. Está testada, mas não está no ar, e aqui está exatamente o que falta para isso.

### 16:00 BRT (19:00 UTC) · Técnico

```text
AgentGuard on Base: tested, not live.

Done: the full stack on Base Sepolia, including from an empty hot wallet. Cap and kill proven on a mainnet fork.

Open: mainnet addresses confirmed live, the hot key read from a file, and its own real-money pilot.
```

> 🇧🇷 AgentGuard na Base: testado, não está no ar.
>
> Feito: a stack completa na Base Sepolia, inclusive a partir de uma hot wallet vazia. Limite e kill comprovados num fork da mainnet.
>
> Em aberto: endereços da mainnet confirmados no ar, a chave da hot wallet lida de um arquivo, e um piloto próprio com dinheiro real.

## Dia 28 · domingo, 06/12/2026 · Semana quatro

### 12:00 BRT (15:00 UTC) · Vídeo

```text
[VIDEO DAY 28]

Four weeks in the open. This week: backups, rate limits, the owner key, one payment end to end, private reporting, and where Base stands.
```

> 🇧🇷 [VIDEO DAY 28]
>
> Quatro semanas em aberto. Nesta semana: backups, limites de requisição, a chave do dono, um pagamento de ponta a ponta, relatos privados, e onde a Base está.

### 16:00 BRT (19:00 UTC) · Resumo da semana

```text
Week four of AgentGuard, plainly:

• a restore drill, checked against the live guard
• forged client IPs, still rate limited
• three conditions for a software-wallet owner
• one mainnet payment, end to end
• Base: tested on Sepolia, not live
```

> 🇧🇷 Semana quatro do AgentGuard, sem rodeios:
>
> • um teste de restauração, conferido com o guard em produção
> • IPs de cliente falsificados, ainda limitados
> • três condições para um dono com carteira de software
> • um pagamento na mainnet, de ponta a ponta
> • Base: testada na Sepolia, não está no ar

### 16:00 BRT (19:00 UTC) · Resumo da semana · resposta ao seu próprio post

⚠️ PREENCHER ANTES DE POSTAR

```text
`[OWNER: what changed in the repo this week, if anything: a fix, a doc, an issue someone reported. Delete if nothing.]`
```

> 🇧🇷 `[OWNER: o que mudou no repositório nesta semana, se algo mudou: uma correção, um documento, uma issue que alguém reportou. Apague se não houve nada.]`
