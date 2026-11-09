# Semana 3: dias 15 a 21

Copie o bloco em inglês e cole no X. A tradução em português fica logo abaixo, só para você saber o que está postando.

## Dia 15 · segunda-feira, 23/11/2026 · A suíte de ataques

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 15]

39 attack cases run in CI: 24 against Solana, 15 against the EVM chains. Each one is a payment that looks fine and isn't.
```

> 🇧🇷 [VIDEO DAY 15]
>
> 39 casos de ataque rodam no CI: 24 contra a Solana, 15 contra as redes EVM. Cada um é um pagamento que parece normal e não é.

### 13:00 BRT (16:00 UTC) · Visual

```text
What a hostile paid API might ask the hot wallet to sign, and what AgentGuard does:

EVM: approve, Permit, Permit2, EIP-7702 → refused
Solana: SPL Approve, SetAuthority, CloseAccount, unknown programs, hidden lookup-table accounts → refused
```

> 🇧🇷 O que uma API paga hostil poderia pedir para a hot wallet assinar, e o que o AgentGuard faz:
>
> EVM: approve, Permit, Permit2, EIP-7702 → recusado
> Solana: SPL Approve, SetAuthority, CloseAccount, programas desconhecidos, contas escondidas em lookup tables → recusado

### 13:00 BRT (16:00 UTC) · Visual · resposta ao seu próprio post

```text
The end-to-end suite also covers the bot side: a bad HMAC, a replayed webhook, a stranger pressing Approve, and one agent trying to read another's intent.

https://github.com/agent443-dot/AgentGuard/tree/main/e2e
```

> 🇧🇷 A suíte end-to-end também cobre o lado do bot: um HMAC inválido, um webhook repetido, um estranho apertando Approve e um agente tentando ler a intent de outro.
>
> https://github.com/agent443-dot/AgentGuard/tree/main/e2e

### 17:00 BRT (20:00 UTC) · Conversa

```text
Which attack should be case 40?

Something you have seen an agent, a paid API or a malicious page try. Describe the shape, not a live exploit: real vulnerabilities go through the repo's private reporting.
```

> 🇧🇷 Qual ataque deveria ser o caso 40?
>
> Algo que você já viu um agente, uma API paga ou uma página maliciosa tentar. Descreva o formato, não um exploit ativo: vulnerabilidades reais vão pelo canal privado de reporte do repositório.

## Dia 16 · terça-feira, 24/11/2026 · Nada de float para dinheiro

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 16]

Every decision AgentGuard makes goes into an audit log with its exact reason. Amounts are exact to a millionth of a dollar and never rounded.
```

> 🇧🇷 [VIDEO DAY 16]
>
> Toda decisão que o AgentGuard toma vai para um log de auditoria com o motivo exato. Os valores são exatos até a milionésima parte de um dólar e nunca arredondados.

### 12:00 BRT (15:00 UTC) · Thread: nada de float para dinheiro · 1/5

```text
A small rule with big consequences in AgentGuard: no floats for money, anywhere. 🧵
```

> 🇧🇷 Uma regra pequena com grandes consequências no AgentGuard: nada de float para dinheiro, em lugar nenhum. 🧵

### 12:00 BRT (15:00 UTC) · Thread: nada de float para dinheiro · 2/5

```text
An agent sends amounts as decimal strings like "0.25", never JSON numbers. A number has already been through a float by the time it arrives.

A sign, an exponent, NaN, Infinity, or more than 6 decimal places is refused, not rounded.
```

> 🇧🇷 Um agente envia valores como strings decimais, por exemplo "0.25", nunca como números JSON. Um número já passou por um float quando chega.
>
> Sinal, expoente, NaN, Infinity ou mais de 6 casas decimais são recusados, não arredondados.

### 12:00 BRT (15:00 UTC) · Thread: nada de float para dinheiro · 3/5

```text
Inside guard-core, amounts are atomic units of the chain's dollar: 6 decimals, kept as bigint.

USDC on Solana and Base, USDG on Robinhood Chain. Both have 6 decimals, so "0.25" means the same everywhere.
```

> 🇧🇷 Dentro do guard-core, os valores são unidades atômicas do dólar da rede: 6 casas decimais, guardadas como bigint.
>
> USDC na Solana e na Base, USDG na Robinhood Chain. Ambos têm 6 casas decimais, então "0.25" significa o mesmo em todo lugar.

### 12:00 BRT (15:00 UTC) · Thread: nada de float para dinheiro · 4/5

```text
Every decision is written to the audit log with its reasons: approved, pending, rejected with which codes, executed with which transaction.

In our restore drill, all 15 audit events came back and matched the live guard.
```

> 🇧🇷 Toda decisão é registrada no log de auditoria com seus motivos: aprovada, pendente, rejeitada com quais códigos, executada com qual transação.
>
> No nosso teste de restauração, todos os 15 eventos de auditoria voltaram e bateram com o guard em produção.

### 12:00 BRT (15:00 UTC) · Thread: nada de float para dinheiro · 5/5

```text
The types, the reject codes and the rules every package follows:

https://github.com/agent443-dot/AgentGuard/blob/main/SPEC.md
```

> 🇧🇷 Os tipos, os códigos de rejeição e as regras que todo pacote segue:
>
> https://github.com/agent443-dot/AgentGuard/blob/main/SPEC.md

### 17:00 BRT (20:00 UTC) · Conversa

```text
Have you ever shipped a float-for-money bug? 0.1 + 0.2 in a payment path, a rounding drift in a balance?

No judgment. Most of us have. That is why amounts here are strings at the edge and bigints inside.
```

> 🇧🇷 Você já colocou em produção um bug de float com dinheiro? 0.1 + 0.2 num fluxo de pagamento, um saldo desviando por arredondamento?
>
> Sem julgamento. A maioria de nós já fez isso. Por isso aqui os valores são strings na entrada e bigints por dentro.

## Dia 17 · quarta-feira, 25/11/2026 · Um sim, um pagamento

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 17]

When you approve a payment in Telegram, you approve that payment: this amount, this recipient, this chain, once. It cannot be reused or stretched.
```

> 🇧🇷 [VIDEO DAY 17]
>
> Quando você aprova um pagamento no Telegram, aprova aquele pagamento: este valor, este destinatário, esta rede, uma vez. A aprovação não pode ser reutilizada nem esticada.

### 13:00 BRT (16:00 UTC) · Técnico

```text
What your approval in AgentGuard covers:

• exactly the approved chain, token, amount, recipient and domain
• redeemed once
• 10 minutes to answer, or it expires: APPROVAL_TIMEOUT
• only listed owners can press the button
```

> 🇧🇷 O que a sua aprovação no AgentGuard cobre:
>
> • exatamente a rede, o token, o valor, o destinatário e o domínio aprovados
> • resgatada uma única vez
> • 10 minutos para responder, ou ela expira: APPROVAL_TIMEOUT
> • só os donos cadastrados podem apertar o botão

### 13:00 BRT (16:00 UTC) · Técnico · resposta ao seu próprio post

```text
For x402, after you approve, the agent repeats the same request and that redeems the approval. If the site changes the terms in between, it doesn't match, and nothing is paid.
```

> 🇧🇷 No x402, depois que você aprova, o agente repete a mesma requisição, e é isso que resgata a aprovação. Se o site mudar os termos nesse meio-tempo, não bate, e nada é pago.

### 17:00 BRT (20:00 UTC) · Conversa

```text
What approval threshold would you set for an agent you trust, but not fully?

Ours is per agent, so a research agent and a trading bot can live under very different rules.
```

> 🇧🇷 Qual limite de aprovação você definiria para um agente em quem confia, mas não totalmente?
>
> O nosso é por agente, então um agente de pesquisa e um bot de trading podem viver sob regras bem diferentes.

## Dia 18 · quinta-feira, 26/11/2026 · O que ainda está em aberto

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 18]

Every project has open issues. These are ours, from our own security review: low severity, none moves money past the policy, all public.
```

> 🇧🇷 [VIDEO DAY 18]
>
> Todo projeto tem pendências em aberto. Estas são as nossas, da nossa própria revisão de segurança: baixa severidade, nenhuma deixa dinheiro passar da política, todas públicas.

### 12:00 BRT (15:00 UTC) · Thread: os achados em aberto · 1/6

```text
The open findings in AgentGuard's security review. All low, none moves money past the policy. We'd rather you read them here than discover them. 🧵
```

> 🇧🇷 Os achados em aberto na revisão de segurança do AgentGuard. Todos de baixa severidade, nenhum deixa dinheiro passar da política. Preferimos que você leia aqui a descobrir sozinho. 🧵

### 12:00 BRT (15:00 UTC) · Thread: os achados em aberto · 2/6

```text
x402:
• the domain allowlist matches the host name, not the port
• a repeated request before you answer opens a second approval
• a paid response over 1 MB is marked failed after the payment
```

> 🇧🇷 x402:
> • a allowlist de domínios compara o nome do host, não a porta
> • uma requisição repetida antes de você responder abre uma segunda aprovação
> • uma resposta paga acima de 1 MB é marcada como falha depois do pagamento

### 12:00 BRT (15:00 UTC) · Thread: os achados em aberto · 3/6

```text
The bot:
• its replay memory is lost on a restart. Its hooks are on Fly's private network, not public
• /status with 25 or more pending approvals goes over Telegram's message size
```

> 🇧🇷 O bot:
> • a memória contra replay se perde num reinício. Os hooks ficam na rede privada da Fly, não são públicos
> • /status com 25 ou mais aprovações pendentes passa do tamanho máximo de mensagem do Telegram

### 12:00 BRT (15:00 UTC) · Thread: os achados em aberto · 4/6

```text
Solana:
• the kill page trusts the multisig from its link, so a decoy multisig you control reads "Already killed". Compare the address with pnpm status
• a payment that creates a token account does not check who pays the rent, about 0.002 SOL
```

> 🇧🇷 Solana:
> • a página de kill confia no multisig que vem no link, então um multisig falso que você controla mostra "Already killed". Compare o endereço com pnpm status
> • um pagamento que cria uma token account não verifica quem paga o aluguel, cerca de 0,002 SOL

### 12:00 BRT (15:00 UTC) · Thread: os achados em aberto · 5/6

```text
Also open, before Base launches: the Base hot key is read from an env value. It has to come from a file, as on Solana, before Base goes live.
```

> 🇧🇷 Também em aberto, antes do lançamento na Base: a chave da hot wallet da Base é lida de uma variável de ambiente. Ela precisa vir de um arquivo, como na Solana, antes de a Base entrar no ar.

### 12:00 BRT (15:00 UTC) · Thread: os achados em aberto · 6/6

```text
If one of these matters for your setup, open an issue or a PR. The list is kept current in the review:

https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

> 🇧🇷 Se algum desses importa para o seu setup, abra uma issue ou um PR. A lista é mantida atualizada na revisão:
>
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md

### 17:00 BRT (20:00 UTC) · Conversa (curta)

```text
Short one today. Which open finding would you fix first?
```

> 🇧🇷 Hoje é rápido. Qual achado em aberto você corrigiria primeiro?

## Dia 19 · sexta-feira, 27/11/2026 · O bot só escuta você

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 19]

The Telegram bot holds the approve button and the kill switch. So it listens only to the owners you list, and to guard-core messages it can verify.
```

> 🇧🇷 [VIDEO DAY 19]
>
> O bot do Telegram guarda o botão de aprovar e o kill switch. Por isso ele só escuta os donos que você cadastrou e as mensagens do guard-core que ele consegue verificar.

### 13:00 BRT (16:00 UTC) · Técnico

```text
How AgentGuard's Telegram bot is locked down:

• ignores anyone not in OWNER_TELEGRAM_IDS
• every hook from guard-core is HMAC-signed, checked before parsing
• stale and duplicate events refused
• no public IP: long polling, hooks over Fly's private network
```

> 🇧🇷 Como o bot do Telegram do AgentGuard é protegido:
>
> • ignora qualquer pessoa fora de OWNER_TELEGRAM_IDS
> • todo hook vindo do guard-core é assinado com HMAC, verificado antes de ser lido
> • eventos antigos e duplicados são recusados
> • sem IP público: long polling, hooks pela rede privada da Fly

### 17:00 BRT (20:00 UTC) · Bastidores: um botão desatualizado

```text
A bug the mainnet pilot found: after /kill, the bot offered a Solana kill button for a limit already removed the day before.

Nothing broke, the page is idempotent, but it sent the owner to a dead button. Now it offers buttons only for limits that still exist (#116).
```

> 🇧🇷 Um bug que o piloto na mainnet encontrou: depois do /kill, o bot ofereceu um botão de kill da Solana para um limite que já tinha sido removido no dia anterior.
>
> Nada quebrou, a página é idempotente, mas mandou o dono para um botão morto. Agora ele só oferece botões para limites que ainda existem (#116).

## Dia 20 · sábado, 28/11/2026 · Lidando com pending_approval

### 12:00 BRT (15:00 UTC) · Vídeo

```text
[VIDEO DAY 20]

Your agent asked to pay, and the payment is waiting for its owner. What should the agent do now? Mostly: wait, and don't ask twice.
```

> 🇧🇷 [VIDEO DAY 20]
>
> Seu agente pediu para pagar, e o pagamento está esperando o dono. O que o agente deve fazer agora? Basicamente: esperar e não pedir duas vezes.

### 16:00 BRT (19:00 UTC) · Técnico

```text
When an AgentGuard payment returns pending_approval, the agent should:

1. tell the user it is waiting
2. call check_intent every 15–30 s
3. never repeat the payment while pending
4. on approved (paid_fetch): repeat exactly the same request, once
```

> 🇧🇷 Quando um pagamento no AgentGuard retorna pending_approval, o agente deve:
>
> 1. avisar o usuário que está aguardando
> 2. chamar check_intent a cada 15–30 s
> 3. nunca repetir o pagamento enquanto estiver pendente
> 4. se aprovado (paid_fetch): repetir exatamente a mesma requisição, uma vez

### 16:00 BRT (19:00 UTC) · Técnico · resposta ao seu próprio post

```text
The tool results already tell the model this. A client that drives the tools without a model should follow the same steps; examples/demo-agent in the mcp-server package does.
```

> 🇧🇷 Os resultados das ferramentas já dizem isso ao modelo. Um cliente que usa as ferramentas sem um modelo deve seguir os mesmos passos; o examples/demo-agent no pacote mcp-server faz isso.

## Dia 21 · domingo, 29/11/2026 · Antes de subir os limites

### 12:00 BRT (15:00 UTC) · Vídeo

```text
[VIDEO DAY 21]

Three weeks in. The launch cap is still 20 a day per chain, and it rises only when a written checklist is done. Here is the checklist.
```

> 🇧🇷 [VIDEO DAY 21]
>
> Três semanas no ar. O limite de lançamento continua 20 por dia por rede, e só sobe quando uma checklist escrita estiver concluída. Aqui está a checklist.

### 16:00 BRT (19:00 UTC) · Thread de resumo · 1/6

```text
AgentGuard launched at 20 a day per chain. It goes to 50 only after each of these holds. Where we stand, plainly. 🧵
```

> 🇧🇷 O AgentGuard foi lançado com 20 por dia por rede. Só vai para 50 depois que cada um destes itens se cumprir. Onde estamos, sem rodeios. 🧵

### 16:00 BRT (19:00 UTC) · Thread de resumo · 2/6

⚠️ PREENCHER ANTES DE POSTAR

```text
1. Two to three weeks on mainnet at the starting cap, with no unexplained intent in the audit log and no alert the owner could not account for.

`[OWNER: status after three weeks]`
```

> 🇧🇷 1. Duas a três semanas na mainnet com o limite inicial, sem nenhuma intent inexplicada no log de auditoria e nenhum alerta que o dono não consiga explicar.
>
> `[OWNER: status depois de três semanas]`

### 16:00 BRT (19:00 UTC) · Thread de resumo · 3/6

⚠️ PREENCHER ANTES DE POSTAR

```text
2. The kill rehearsed on Solana mainnet, timed from /kill to the transaction confirming.

`[OWNER: done with the time, or "not yet"]`
```

> 🇧🇷 2. O kill ensaiado na mainnet da Solana, cronometrado do /kill até a transação ser confirmada.
>
> `[OWNER: feito, com o tempo, ou "ainda não"]`

### 16:00 BRT (19:00 UTC) · Thread de resumo · 4/6

⚠️ PREENCHER ANTES DE POSTAR

```text
3. A backup schedule that copies the database off the Fly volume. Today: daily volume snapshots and a tested restore, but nothing off the volume yet.

`[OWNER: update if done]`
```

> 🇧🇷 3. Uma rotina de backup que copia o banco de dados para fora do volume da Fly. Hoje: snapshots diários do volume e uma restauração testada, mas ainda nada fora do volume.
>
> `[OWNER: atualizar se já foi feito]`

### 16:00 BRT (19:00 UTC) · Thread de resumo · 5/6

```text
4. The hot keys in a KMS, once the cap rises.
5. For Base: its addresses confirmed live and its own pilot, as Robinhood Chain had.
```

> 🇧🇷 4. As chaves das hot wallets num KMS, quando o limite subir.
> 5. Para a Base: endereços confirmados em produção e um piloto próprio, como a Robinhood Chain teve.

### 16:00 BRT (19:00 UTC) · Thread de resumo · 6/6

```text
Three weeks of recaps, risks and fixes are all in the repo. If you are running it, tell us what you've hit.

https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md
```

> 🇧🇷 Três semanas de resumos, riscos e correções estão todas no repositório. Se você está rodando o AgentGuard, conte para a gente o que encontrou.
>
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md
