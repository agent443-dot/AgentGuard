# Semana 2: dias 8 a 14

Copie o bloco em inglês e cole no X. A tradução em português fica logo abaixo, só para você saber o que está postando.

## Dia 08 · segunda-feira, 16/11/2026 · Rode o seu próprio

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 08]

AgentGuard has no hosted service. You run your own guard, your own Telegram bot and your own signing page, and your vault belongs to your own Phantom wallet. Here is what that takes.
```

> 🇧🇷 [VIDEO DAY 08]
>
> O AgentGuard não tem serviço hospedado. Você roda o seu próprio guard, o seu próprio bot de Telegram e a sua própria página de assinatura, e o seu cofre pertence à sua própria carteira Phantom. Veja o que isso exige.

### 13:00 BRT (16:00 UTC) · Técnico: o que você precisa

```text
Before you self-host AgentGuard you need:

• Node 20+ and pnpm 10
• Fly.io, with a card on the account
• Vercel or any static host, for your signing page
• Telegram and a bot token
• a new Phantom wallet with its own phrase, used for nothing else
```

> 🇧🇷 Antes de hospedar o AgentGuard por conta própria, você precisa de:
>
> • Node 20+ e pnpm 10
> • Fly.io, com um cartão na conta
> • Vercel ou qualquer host estático, para a sua página de assinatura
> • Telegram e um token de bot
> • uma carteira Phantom nova, com frase própria, usada para nada mais

### 13:00 BRT (16:00 UTC) · Técnico: o que você precisa · resposta ao seu próprio post

```text
Two things the guide learned the hard way: Fly trial machines stop after 5 minutes without a card, and on Windows you want WSL2 with the repo under ~, not /mnt/c.

https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md
```

> 🇧🇷 Duas coisas que o guia aprendeu do jeito difícil: as máquinas de teste do Fly param depois de 5 minutos sem cartão, e no Windows você quer o WSL2 com o repositório em ~, não em /mnt/c.
>
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md

### 17:00 BRT (20:00 UTC) · Conversa

```text
Honest question for people who run agents:

What stops you from self-hosting infrastructure like this? Time, cost, trust in your own ops, something else?

We chose self-hosted on purpose: nothing in the money path belongs to us. We know it has a cost.
```

> 🇧🇷 Pergunta sincera para quem roda agentes:
>
> O que impede você de hospedar por conta própria uma infraestrutura como esta? Tempo, custo, confiança na sua própria operação, outra coisa?
>
> Escolhemos o self-hosted de propósito: nada no caminho do dinheiro pertence a nós. Sabemos que isso tem um custo.

## Dia 09 · terça-feira, 17/11/2026 · x402, e conteúdo pago como dado

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 09]

x402 lets an API charge a small fee per request. With AgentGuard, your agent never pays it directly: the guard reads the payment request, checks it, and pays only if your policy allows. #x402
```

> 🇧🇷 [VIDEO DAY 09]
>
> O x402 permite que uma API cobre uma pequena taxa por requisição. Com o AgentGuard, o seu agente nunca paga direto: o guard lê o pedido de pagamento, confere e só paga se a sua política permitir. #x402

### 12:00 BRT (15:00 UTC) · Thread: conteúdo pago é dado · 1/7

```text
How an agent pays an x402 API through AgentGuard, and the one risk we have only limited, not solved. 🧵
```

> 🇧🇷 Como um agente paga uma API x402 pelo AgentGuard, e o único risco que apenas limitamos, sem resolver. 🧵

### 12:00 BRT (15:00 UTC) · Thread: conteúdo pago é dado · 2/7

```text
The agent calls paid_fetch with a URL. guard-core makes the request.

If the site answers 402, guard-core parses the terms: network, asset, payTo, amount. A domain not on the allowlist is refused before any request is made.
```

> 🇧🇷 O agente chama paid_fetch com uma URL. O guard-core faz a requisição.
>
> Se o site responde 402, o guard-core lê os termos: rede, ativo, payTo, valor. Um domínio fora da allowlist é recusado antes de qualquer requisição.

### 12:00 BRT (15:00 UTC) · Thread: conteúdo pago é dado · 3/7

```text
Then the usual: per-payment and daily limits, a simulation of the exact transfer, and your approval on Telegram above your threshold.

Before signing, the 402's network, asset, payTo and amount must equal the intent that was approved. A payTo moved on the retry is refused.
```

> 🇧🇷 Depois, o de sempre: limites por pagamento e diários, uma simulação da transferência exata e a sua aprovação no Telegram acima do seu limite de aprovação.
>
> Antes de assinar, a rede, o ativo, o payTo e o valor do 402 precisam ser iguais à intenção aprovada. Um payTo alterado na nova tentativa é recusado.

### 12:00 BRT (15:00 UTC) · Thread: conteúdo pago é dado · 4/7

```text
x402 runs over https only. Plain http is allowed only to loopback.

That came from our pre-release review: over plain http, anyone on the path could rewrite the 402 and its payTo.
```

> 🇧🇷 O x402 roda só sobre https. http simples é permitido apenas para loopback.
>
> Isso veio da nossa revisão pré-lançamento: em http simples, qualquer um no caminho poderia reescrever o 402 e o seu payTo.

### 12:00 BRT (15:00 UTC) · Thread: conteúdo pago é dado · 5/7

```text
The paid response comes back to the agent fenced as untrusted third-party data, and the model is told never to follow instructions inside it.

That is known risk #7: limited, not solved.
```

> 🇧🇷 A resposta paga volta para o agente isolada como dado não confiável de terceiros, e o modelo é instruído a nunca seguir instruções que estejam dentro dela.
>
> Esse é o risco conhecido nº 7: limitado, não resolvido.

### 12:00 BRT (15:00 UTC) · Thread: conteúdo pago é dado · 6/7

```text
A model that ignores the marking can still ask to pay. What it cannot do is pay more than the policy allows, pay a domain you did not allow, or skip your approval above the threshold.

The limit is the policy, not the model's good behavior.
```

> 🇧🇷 Um modelo que ignora essa marcação ainda pode pedir para pagar. O que ele não pode é pagar mais do que a política permite, pagar um domínio que você não liberou ou pular a sua aprovação acima do limite.
>
> O limite é a política, não o bom comportamento do modelo.

### 12:00 BRT (15:00 UTC) · Thread: conteúdo pago é dado · 7/7

```text
The tools, the errors and what an agent should do with each one:

https://github.com/agent443-dot/AgentGuard/blob/main/packages/mcp-server/README.md#for-agent-builders
```

> 🇧🇷 As ferramentas, os erros e o que um agente deve fazer com cada um:
>
> https://github.com/agent443-dot/AgentGuard/blob/main/packages/mcp-server/README.md#for-agent-builders

### 17:00 BRT (20:00 UTC) · Conversa

```text
Would you let an agent buy API calls on its own, without asking, if each one is under $1 and the day is capped?

Where is your "auto-approve" line? Our guide suggests asking above 1.
```

> 🇧🇷 Você deixaria um agente comprar chamadas de API sozinho, sem perguntar, se cada uma custar menos de $1 e o dia tiver um teto?
>
> Onde fica a sua linha de "aprovação automática"? O nosso guia sugere pedir aprovação acima de 1.

## Dia 10 · quarta-feira, 18/11/2026 · A revisão pré-lançamento

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 10]

Before the repository went public, every package got a review. No critical finding. Two high and six medium, each checked against the code and fixed with a test.
```

> 🇧🇷 [VIDEO DAY 10]
>
> Antes de o repositório ficar público, cada pacote passou por uma revisão. Nenhum achado crítico. Dois altos e seis médios, cada um conferido no código e corrigido com um teste.

### 13:00 BRT (16:00 UTC) · Bastidores: os achados

```text
The two high findings from our pre-release review:

1. The Solana kill page took the hot wallet from its link. A wrong one showed "Already killed" while the real limit stayed live.
2. A pause did not reach a payment already waiting on the agent's lock.

Both fixed, with tests.
```

> 🇧🇷 Os dois achados altos da nossa revisão pré-lançamento:
>
> 1. A página de kill da Solana pegava a hot wallet do próprio link. Uma errada mostrava "Already killed" enquanto o limite real continuava ativo.
> 2. Uma pausa não alcançava um pagamento que já estava esperando no lock do agente.
>
> Os dois corrigidos, com testes.

### 13:00 BRT (16:00 UTC) · Bastidores: os achados · resposta ao seu próprio post

```text
Some of the mediums:
• status printed "spending limit: none" for any read error, which is what confirms a kill
• viem quotes the RPC URL in its errors, so a key in the URL could reach logs; guard-core now strips every URL

Full table:
https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

> 🇧🇷 Alguns dos médios:
> • o status mostrava "spending limit: none" para qualquer erro de leitura, e é isso que confirma um kill
> • o viem cita a URL do RPC nos erros, então uma chave na URL poderia chegar aos logs; o guard-core agora remove todas as URLs
>
> Tabela completa:
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md

### 17:00 BRT (20:00 UTC) · Conversa

```text
Ask us anything about the pre-release review: what we looked at, what we fixed, what is still open.

The whole thing is public, including the low findings we have not fixed yet.
```

> 🇧🇷 Pergunte o que quiser sobre a revisão pré-lançamento: o que olhamos, o que corrigimos, o que ainda está aberto.
>
> Está tudo público, inclusive os achados baixos que ainda não corrigimos.

## Dia 11 · quinta-feira, 19/11/2026 · Nenhum contrato próprio

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 11]

On Robinhood Chain, the daily cap is the Safe Allowance Module: the hot wallet is a delegate with an allowance that refills every 24 hours. The blockchain enforces it, not our code.
```

> 🇧🇷 [VIDEO DAY 11]
>
> Na Robinhood Chain, o teto diário é o Safe Allowance Module: a hot wallet é uma delegada com uma permissão que se renova a cada 24 horas. Quem garante isso é a blockchain, não o nosso código.

### 12:00 BRT (15:00 UTC) · Thread: por que não há contrato próprio · 1/6

```text
AgentGuard moves money onchain, and we wrote zero smart contracts for it. That was a deliberate choice. 🧵
```

> 🇧🇷 O AgentGuard movimenta dinheiro onchain, e não escrevemos nenhum smart contract para isso. Foi uma escolha deliberada. 🧵

### 12:00 BRT (15:00 UTC) · Thread: por que não há contrato próprio · 2/6

```text
The cap is the part that has to hold when everything else fails. So it should be code that is already audited, already live and widely used, not code we wrote last month.

Squads v4 on Solana. Safe and the Safe Allowance Module 0.1.1 on EVM.
```

> 🇧🇷 O teto é a parte que precisa aguentar quando todo o resto falha. Então ele deve ser código já auditado, já em produção e amplamente usado, não código que escrevemos no mês passado.
>
> Squads v4 na Solana. Safe e o Safe Allowance Module 0.1.1 em EVM.

### 12:00 BRT (15:00 UTC) · Thread: por que não há contrato próprio · 3/6

```text
That splits the job in two:

• our code (guard-core) decides what to pay: policy, simulation, approval
• their code caps how much can be drawn in a day

The two layers do not trust each other.
```

> 🇧🇷 Isso divide o trabalho em dois:
>
> • o nosso código (guard-core) decide o que pagar: política, simulação, aprovação
> • o código deles limita quanto pode ser sacado em um dia
>
> As duas camadas não confiam uma na outra.

### 12:00 BRT (15:00 UTC) · Thread: por que não há contrato próprio · 4/6

```text
The trade-off: we take what those programs offer. The Allowance Module has no destination lock, so on Safe chains a stolen hot key can send the day's cap anywhere.

Same loss bound, wider path. Known risk #1.
```

> 🇧🇷 A contrapartida: ficamos com o que esses programas oferecem. O Allowance Module não trava o destino, então nas chains com Safe uma hot key roubada pode mandar o teto do dia para qualquer lugar.
>
> Mesmo limite de perda, caminho mais amplo. Risco conhecido nº 1.

### 12:00 BRT (15:00 UTC) · Thread: por que não há contrato próprio · 5/6

```text
How we checked we are using the real thing:

• CI probes that the Squads v4 program on Solana mainnet is the binary the tests run
• every address in .env is checked against the chain: it must hold code, and the dollar must report 6 decimals
```

> 🇧🇷 Como conferimos que estamos usando a coisa real:
>
> • o CI verifica que o programa Squads v4 na Solana mainnet é o mesmo binário que os testes rodam
> • cada endereço do .env é conferido na chain: precisa conter código, e o dólar precisa informar 6 casas decimais

### 12:00 BRT (15:00 UTC) · Thread: por que não há contrato próprio · 6/6

```text
The verified addresses live in packages/shared, and they win over anything in .env.

https://github.com/agent443-dot/AgentGuard/tree/main
```

> 🇧🇷 Os endereços verificados ficam em packages/shared, e eles prevalecem sobre qualquer coisa no .env.
>
> https://github.com/agent443-dot/AgentGuard/tree/main

### 17:00 BRT (20:00 UTC) · Dica visual

```text
If you fund a Safe on Robinhood Chain, check the token address, not the name. Other tokens on that chain share it.

USDG: 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168

Our self-host guide makes you check it before you send.
```

> 🇧🇷 Se você for abastecer um Safe na Robinhood Chain, confira o endereço do token, não o nome. Outros tokens nessa chain usam o mesmo nome.
>
> USDG: 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
>
> O nosso guia de self-host faz você conferir antes de enviar.

## Dia 12 · sexta-feira, 20/11/2026 · A página de assinatura é uma raiz de confiança

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 12]

You sign your vault's setup and its kill in Phantom, on a static page. Whoever can change that page can show you a harmless summary of a harmful transaction. So you deploy your own.
```

> 🇧🇷 [VIDEO DAY 12]
>
> Você assina a configuração do seu cofre e o kill dele na Phantom, em uma página estática. Quem consegue alterar essa página pode mostrar um resumo inofensivo de uma transação perigosa. Por isso você publica a sua própria.

### 13:00 BRT (16:00 UTC) · Técnico

```text
Known risk #3: the signing page is a trust root.

So each user deploys their own, from their own protected main:
• builds main only, previews off
• strict Content-Security-Policy, no third-party scripts at runtime
• hot wallet addresses built in; a link cannot change them
```

> 🇧🇷 Risco conhecido nº 3: a página de assinatura é uma raiz de confiança.
>
> Por isso cada usuário publica a sua, a partir do seu próprio main protegido:
> • build só do main, previews desligados
> • Content-Security-Policy rígida, sem scripts de terceiros em execução
> • endereços das hot wallets embutidos; um link não consegue mudá-los

### 13:00 BRT (16:00 UTC) · Técnico · resposta ao seu próprio post

```text
Why previews off: a preview build of a PR branch would be an unreviewed signing page on a public URL.

After you deploy, check the page names your hot wallets:
curl -s https://<your page>/app.js | grep -o 'hot:"[^"]*"'
```

> 🇧🇷 Por que previews desligados: um build de preview de um branch de PR seria uma página de assinatura não revisada em uma URL pública.
>
> Depois de publicar, confira se a página mostra as suas hot wallets:
> curl -s https://<your page>/app.js | grep -o 'hot:"[^"]*"'

### 17:00 BRT (20:00 UTC) · Conversa

```text
Where do you sign your most sensitive transactions?

A hardware wallet, a mobile wallet, a browser extension, a multisig app?

We launched with a software-wallet owner on purpose and wrote down the conditions. Curious what others accept.
```

> 🇧🇷 Onde você assina as suas transações mais sensíveis?
>
> Uma hardware wallet, uma carteira de celular, uma extensão de navegador, um app de multisig?
>
> Lançamos com o dono em uma carteira de software de propósito, e deixamos as condições por escrito. Curioso para saber o que os outros aceitam.

## Dia 13 · sábado, 21/11/2026 · Um agente novo não gasta um centavo

### 12:00 BRT (15:00 UTC) · Vídeo

```text
[VIDEO DAY 13]

A new agent in AgentGuard is denied everything. Empty allowlists mean no recipient and no domain. You open exactly what it needs, nothing more.
```

> 🇧🇷 [VIDEO DAY 13]
>
> Um agente novo no AgentGuard tem tudo negado. Allowlists vazias significam nenhum destinatário e nenhum domínio. Você libera exatamente o que ele precisa, nada mais.

### 16:00 BRT (19:00 UTC) · Técnico: uma primeira política

```text
A sensible first policy, from our self-host guide:

5 per payment
20 a day
your approval from 1 up
only the API domains you trust

Amounts are strings in base units, never floats. An empty allowlist denies everything.
```

> 🇧🇷 Uma primeira política sensata, do nosso guia de self-host:
>
> 5 por pagamento
> 20 por dia
> a sua aprovação a partir de 1
> só os domínios de API em que você confia
>
> Os valores são strings em unidades base, nunca floats. Uma allowlist vazia nega tudo.

## Dia 14 · domingo, 22/11/2026 · Semana dois

### 12:00 BRT (15:00 UTC) · Vídeo

```text
[VIDEO DAY 14]

Two weeks in the open. This week: self-hosting, x402, the pre-release review, why we wrote no contract, and why your signing page is yours.
```

> 🇧🇷 [VIDEO DAY 14]
>
> Duas semanas em aberto. Nesta semana: self-hosting, x402, a revisão pré-lançamento, por que não escrevemos contrato e por que a sua página de assinatura é sua.

### 16:00 BRT (19:00 UTC) · Thread de resumo · 1/5

```text
Week two of AgentGuard, plainly. 🧵
```

> 🇧🇷 Semana dois do AgentGuard, sem rodeios. 🧵

### 16:00 BRT (19:00 UTC) · Thread de resumo · 2/5

```text
Self-hosting: no hosted service. Your guard, your bot, your signing page, your vault. The guide goes in order, and every step links the command that does it.
```

> 🇧🇷 Self-hosting: sem serviço hospedado. O seu guard, o seu bot, a sua página de assinatura, o seu cofre. O guia segue em ordem, e cada passo aponta o comando que o executa.

### 16:00 BRT (19:00 UTC) · Thread de resumo · 3/5

```text
x402: the guard pays only when the 402's terms match the approved intent. Paid content comes back marked as data. Prompt injection is limited by the policy, not solved.
```

> 🇧🇷 x402: o guard só paga quando os termos do 402 batem com a intenção aprovada. O conteúdo pago volta marcado como dado. Prompt injection é limitado pela política, não resolvido.

### 16:00 BRT (19:00 UTC) · Thread de resumo · 4/5

```text
Our pre-release review: two high, six medium, all fixed with tests. The low findings still open are listed too.

Onchain: Squads and Safe, no contract of ours.
```

> 🇧🇷 A nossa revisão pré-lançamento: dois altos, seis médios, todos corrigidos com testes. Os achados baixos ainda abertos também estão listados.
>
> Onchain: Squads e Safe, nenhum contrato nosso.

### 16:00 BRT (19:00 UTC) · Thread de resumo · 5/5

⚠️ PREENCHER ANTES DE POSTAR

```text
`[OWNER: one or two real things from this week: a fix merged, an issue reported, a question that changed a doc. Delete this post if there were none.]`
```

> 🇧🇷 `[OWNER: uma ou duas coisas reais desta semana: uma correção incorporada, um problema reportado, uma pergunta que mudou um documento. Apague este post se não houve nenhuma.]`
