# Semana 1: dias 1 a 7

Copie o bloco em inglês e cole no X. A tradução em português fica logo abaixo, só para você saber o que está postando.

## Dia 01 · segunda-feira, 09/11/2026 · Lançamento

### 10:00 BRT (13:00 UTC) · Thread de anúncio (fixar) · 1/8

```text
Your AI agent can pay for things now. It still never touches a private key.

AgentGuard is public: an open-source guard between agents and money. Policy, simulation, your approval on Telegram, and a daily cap enforced onchain.

Live on Robinhood Chain mainnet. 🧵
```

> 🇧🇷 Seu agente de IA já pode pagar por coisas. E continua sem nunca tocar numa chave privada.
>
> O AgentGuard é público: um guard open-source entre agentes e dinheiro. Política, simulação, sua aprovação no Telegram e um limite diário imposto onchain.
>
> No ar na mainnet da Robinhood Chain. 🧵

### 10:00 BRT (13:00 UTC) · Thread de anúncio (fixar) · 2/8

```text
The problem: an agent that can pay needs a key, and an agent with a key can be talked into anything.

AgentGuard splits the two. The agent asks to pay through MCP. guard-core decides, and only guard-core signs.
```

> 🇧🇷 O problema: um agente que pode pagar precisa de uma chave, e um agente com uma chave pode ser convencido a fazer qualquer coisa.
>
> O AgentGuard separa os dois. O agente pede para pagar via MCP. O guard-core decide, e só o guard-core assina.

### 10:00 BRT (13:00 UTC) · Thread de anúncio (fixar) · 3/8

```text
Where the money lives:

Your vault (a Safe, or a Squads multisig on Solana) belongs to your own Phantom wallet.

An onchain daily cap lets a small hot wallet draw from it. The hot wallet's key is held only by guard-core.
```

> 🇧🇷 Onde o dinheiro fica:
>
> Seu cofre (um Safe, ou um multisig Squads na Solana) pertence à sua própria carteira Phantom.
>
> Um limite diário onchain deixa uma pequena hot wallet (carteira quente) sacar dele. A chave da hot wallet fica só com o guard-core.

### 10:00 BRT (13:00 UTC) · Thread de anúncio (fixar) · 4/8

```text
Every payment goes through:

1. A deny-all policy per agent: per-payment and daily limits, allowed chains, tokens, recipients, domains
2. A simulation of the exact transfer
3. Your approval on Telegram above your threshold

Approvals expire and are redeemed once.
```

> 🇧🇷 Todo pagamento passa por:
>
> 1. Uma política por agente que nega tudo por padrão: limites por pagamento e por dia, redes, tokens, destinatários e domínios permitidos
> 2. Uma simulação da transferência exata
> 3. Sua aprovação no Telegram acima do seu limite de aprovação
>
> Aprovações expiram e só podem ser usadas uma vez.

### 10:00 BRT (13:00 UTC) · Thread de anúncio (fixar) · 5/8

```text
The worst case, in writing:

The most a day can cost is the daily cap plus what sits in the hot wallet. That holds even if guard-core is compromised, because the cap is enforced by Squads or the Safe Allowance Module.

We wrote no contract of our own.
```

> 🇧🇷 O pior caso, por escrito:
>
> O máximo que um dia pode custar é o limite diário mais o que estiver na hot wallet. Isso vale mesmo se o guard-core for comprometido, porque o limite é imposto pelo Squads ou pelo Safe Allowance Module.
>
> Não escrevemos nenhum contrato próprio.

### 10:00 BRT (13:00 UTC) · Thread de anúncio (fixar) · 6/8

```text
Something wrong? /kill in Telegram pauses every agent. One Phantom signature then removes the onchain cap.

We ran it with real money on Robinhood Chain mainnet: a 0.50 USDG x402 payment, then the kill. Each result was read back from the chain.
```

> 🇧🇷 Algo errado? /kill no Telegram pausa todos os agentes. Uma assinatura na Phantom remove o limite onchain.
>
> Fizemos isso com dinheiro real na mainnet da Robinhood Chain: um pagamento x402 de 0,50 USDG e depois o kill. Cada resultado foi conferido direto na chain.

### 10:00 BRT (13:00 UTC) · Thread de anúncio (fixar) · 7/8

```text
What is early, plainly:

• Launch caps: 20 a day per chain
• Solana mainnet is next, Base after it
• No hosted service: you run your own guard, bot and signing page
• 7 known risks are listed in the final report, with what is still open
```

> 🇧🇷 O que ainda é cedo, sem rodeios:
>
> • Limites de lançamento: 20 por dia por rede
> • Solana mainnet é a próxima, Base depois
> • Sem serviço hospedado: você roda seu próprio guard, bot e página de assinatura
> • 7 riscos conhecidos estão listados no relatório final, com o que ainda está em aberto

### 10:00 BRT (13:00 UTC) · Thread de anúncio (fixar) · 8/8

```text
What makes it different: no key in the agent, no contract of ours, a loss bound enforced onchain, and a real-money mainnet pilot. Plus 895 tests and 39 attack cases.

Apache-2.0. Read it, run it, try to break it.

https://github.com/agent443-dot/AgentGuard/tree/main
```

> 🇧🇷 O que o torna diferente: nenhuma chave no agente, nenhum contrato nosso, um teto de perda imposto onchain e um piloto com dinheiro real na mainnet. Mais 895 testes e 39 casos de ataque.
>
> Apache-2.0. Leia, rode, tente quebrar.
>
> https://github.com/agent443-dot/AgentGuard/tree/main

### 10:45 BRT (13:45 UTC) · Vídeo

```text
[VIDEO DAY 01]

AgentGuard in one minute: what sits between your agent and your money, and what happens when you press /kill.
```

> 🇧🇷 [VIDEO DAY 01]
>
> AgentGuard em um minuto: o que fica entre o seu agente e o seu dinheiro, e o que acontece quando você aperta /kill.

### 13:00 BRT (16:00 UTC) · Bastidores

```text
Release-day check, real output from `pnpm test`:

guard-core 307
onchain 218
mcp-server 168
telegram-bot 149
e2e 53

895 passing. CI also runs the Foundry fork tests and the signing page in a real Chromium.
```

> 🇧🇷 Checagem do dia do lançamento, saída real do `pnpm test`:
>
> guard-core 307
> onchain 218
> mcp-server 168
> telegram-bot 149
> e2e 53
>
> 895 passando. A CI também roda os testes Foundry em fork e a página de assinatura num Chromium real.

### 15:00 BRT (18:00 UTC) · Visual: o piloto

```text
Before going public we ran it with real money on Robinhood Chain mainnet:

• a Safe owned by a fresh Phantom wallet
• a 5 USDG daily allowance for the hot wallet
• a 0.50 USDG x402 payment
• /kill, then Phantom removed the delegate

All read back from the chain.
```

> 🇧🇷 Antes de abrir o código, rodamos com dinheiro real na mainnet da Robinhood Chain:
>
> • um Safe controlado por uma carteira Phantom nova
> • uma permissão diária de 5 USDG para a hot wallet
> • um pagamento x402 de 0,50 USDG
> • /kill, e depois a Phantom removeu o delegate
>
> Tudo conferido direto na chain.

### 15:00 BRT (18:00 UTC) · Visual: o piloto · resposta ao seu próprio post

```text
The full pilot log, with the transaction and what each step read back:
https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

> 🇧🇷 O registro completo do piloto, com a transação e o que cada etapa mostrou na chain:
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md

### 17:30 BRT (20:30 UTC) · Conversa

```text
Question for people building agents that pay:

What should an agent never be able to pay for, no matter what the prompt says?

We start every agent at deny-all and make you allow each domain and recipient. Curious where you draw the line.
```

> 🇧🇷 Pergunta para quem constrói agentes que pagam:
>
> O que um agente nunca deveria poder pagar, não importa o que o prompt diga?
>
> Começamos todo agente negando tudo e fazemos você liberar cada domínio e destinatário. Queremos saber onde você traça a linha.

### 19:30 BRT (22:30 UTC) · Rodada de respostas

```text
Thanks to everyone who read the code today and asked hard questions. Keep them coming: the known risks and open items are all in the repo, and we would rather hear about a hole now than later.
```

> 🇧🇷 Obrigado a todos que leram o código hoje e fizeram perguntas difíceis. Continuem: os riscos conhecidos e os itens em aberto estão todos no repositório, e preferimos saber de uma falha agora do que depois.

## Dia 02 · terça-feira, 10/11/2026 · Solana

### 10:30 BRT (13:30 UTC) · Vídeo · Variante A, Solana no ar (dono confirmou)

```text
[VIDEO DAY 02]

AgentGuard is now live on Solana mainnet too.

Same guard, same policy, same /kill. On Solana the daily cap is a Squads v4 Spending Limit, with the hot wallet as its only member and only destination. Launch cap: 20 a day.
```

> 🇧🇷 [VIDEO DAY 02]
>
> O AgentGuard agora também está no ar na mainnet da Solana.
>
> Mesmo guard, mesma política, mesmo /kill. Na Solana o limite diário é um Spending Limit do Squads v4, com a hot wallet como único membro e único destino. Limite de lançamento: 20 por dia.

### 10:30 BRT (13:30 UTC) · Vídeo · Variante B, Solana ainda é a próxima

```text
[VIDEO DAY 02]

Robinhood Chain: live. Solana: next. Base: later.

On Solana the cap is a Squads v4 Spending Limit. It ran end to end on devnet with real Telegram and Phantom, and the cap is tested against the real Squads program. Mainnet when it is ready.
```

> 🇧🇷 [VIDEO DAY 02]
>
> Robinhood Chain: no ar. Solana: a próxima. Base: depois.
>
> Na Solana o limite é um Spending Limit do Squads v4. Rodou de ponta a ponta na devnet com Telegram e Phantom reais, e o limite é testado contra o programa real do Squads. Mainnet quando estiver pronta.

### 12:00 BRT (15:00 UTC) · Thread: mesma promessa, dois mecanismos · 1/6

```text
AgentGuard makes one onchain promise on every chain: the worst day costs the daily cap plus the hot wallet balance.

But the mechanism differs between Solana and the Safe chains, and that difference matters. A short thread. 🧵
```

> 🇧🇷 O AgentGuard faz uma promessa onchain em toda rede: o pior dia custa o limite diário mais o saldo da hot wallet.
>
> Mas o mecanismo muda entre a Solana e as redes com Safe, e essa diferença importa. Uma thread curta. 🧵

### 12:00 BRT (15:00 UTC) · Thread: mesma promessa, dois mecanismos · 2/6

```text
On Solana the cap is a Squads v4 Spending Limit.

The hot wallet is its only member and its only destination. A stolen hot key can draw the day's cap, but only into the hot wallet itself.
```

> 🇧🇷 Na Solana o limite é um Spending Limit do Squads v4.
>
> A hot wallet é o único membro e o único destino. Uma chave quente roubada pode sacar o limite do dia, mas só para a própria hot wallet.

### 12:00 BRT (15:00 UTC) · Thread: mesma promessa, dois mecanismos · 3/6

```text
On Robinhood Chain (and Base later) the cap is the Safe Allowance Module 0.1.1.

The hot wallet is the delegate, and a delegate can send its allowance to any address. A stolen hot key could move the day's cap straight out, without guard-core seeing it.
```

> 🇧🇷 Na Robinhood Chain (e na Base, depois) o limite é o Safe Allowance Module 0.1.1.
>
> A hot wallet é o delegate, e um delegate pode enviar sua permissão para qualquer endereço. Uma chave quente roubada poderia tirar o limite do dia direto, sem o guard-core ver.

### 12:00 BRT (15:00 UTC) · Thread: mesma promessa, dois mecanismos · 4/6

```text
Same bound, different path. That is known risk #1 in our final report, not a footnote.

It is one reason the launch cap is 20 a day per chain, and why the hot keys move to a KMS once caps rise.
```

> 🇧🇷 Mesmo teto, caminho diferente. Esse é o risco conhecido nº 1 no nosso relatório final, não uma nota de rodapé.
>
> É um dos motivos de o limite de lançamento ser 20 por dia por rede, e de as chaves quentes irem para um KMS quando os limites subirem.

### 12:00 BRT (15:00 UTC) · Thread: mesma promessa, dois mecanismos · 5/6

```text
How the cap was proven:

• Solana: automated tests against the real Squads program under LiteSVM: cap, cap + 1, daily refill, after kill
• Safe: Foundry on a Base mainnet fork, and live on Robinhood Chain mainnet
```

> 🇧🇷 Como o limite foi comprovado:
>
> • Solana: testes automatizados contra o programa real do Squads no LiteSVM: limite, limite + 1, recarga diária, depois do kill
> • Safe: Foundry num fork da mainnet da Base, e ao vivo na mainnet da Robinhood Chain

### 12:00 BRT (15:00 UTC) · Thread: mesma promessa, dois mecanismos · 6/6

```text
The table of what works on each chain, and the seven known risks:

https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md
```

> 🇧🇷 A tabela do que funciona em cada rede, e os sete riscos conhecidos:
>
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md

### 17:00 BRT (20:00 UTC) · Conversa

```text
If your agent can pay for things today: what is its per-payment limit?

"None" is an honest answer. We started from deny-all and still argue about where the default approval threshold should sit.
```

> 🇧🇷 Se o seu agente já pode pagar por coisas hoje: qual é o limite por pagamento dele?
>
> "Nenhum" é uma resposta honesta. Começamos negando tudo e ainda discutimos onde deveria ficar o limite padrão de aprovação.

## Dia 03 · quarta-feira, 11/11/2026 · O agente nunca segura uma chave

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 03]

Your agent connects to AgentGuard over MCP. It can ask to pay. It cannot touch a key, change its own limits, or approve itself.
```

> 🇧🇷 [VIDEO DAY 03]
>
> Seu agente se conecta ao AgentGuard via MCP. Ele pode pedir para pagar. Não pode tocar numa chave, mudar os próprios limites nem se autoaprovar.

### 13:00 BRT (16:00 UTC) · Técnico: conectar o Claude Code

```text
Connecting an agent is one command. Claude Code over stdio:

claude mcp add agentguard -e GUARD_URL=… -e AGENT_ID=… -e AGENT_TOKEN=… -- tsx …/mcp-server/src/main.ts

Claude Desktop, HTTP and any other MCP client are in the README. #MCP
```

> 🇧🇷 Conectar um agente é um comando. Claude Code via stdio:
>
> claude mcp add agentguard -e GUARD_URL=… -e AGENT_ID=… -e AGENT_TOKEN=… -- tsx …/mcp-server/src/main.ts
>
> Claude Desktop, HTTP e qualquer outro cliente MCP estão no README. #MCP

### 13:00 BRT (16:00 UTC) · Técnico: conectar o Claude Code · resposta ao seu próprio post

```text
Setup for Claude Desktop, Claude Code over stdio or HTTP, and any other client:
https://github.com/agent443-dot/AgentGuard/blob/main/packages/mcp-server/README.md#for-agent-builders
```

> 🇧🇷 Configuração para Claude Desktop, Claude Code via stdio ou HTTP, e qualquer outro cliente:
> https://github.com/agent443-dot/AgentGuard/blob/main/packages/mcp-server/README.md#for-agent-builders

### 15:00 BRT (18:00 UTC) · Visual: quatro ferramentas

```text
Everything an agent can do with money through AgentGuard:

paid_fetch: pay an x402 API
transfer: send to an allowed address
get_budget: read today's spend and limits
check_intent: follow a payment through approval

No tool returns a key. No tool changes a limit.
```

> 🇧🇷 Tudo o que um agente pode fazer com dinheiro pelo AgentGuard:
>
> paid_fetch: pagar uma API x402
> transfer: enviar para um endereço permitido
> get_budget: ver o gasto do dia e os limites
> check_intent: acompanhar um pagamento até a aprovação
>
> Nenhuma ferramenta devolve uma chave. Nenhuma ferramenta muda um limite.

### 17:00 BRT (20:00 UTC) · Conversa

```text
How do your agents pay for APIs today?

• a key in an env var
• a prepaid account per API
• they don't, a human does
• something else

Genuinely asking. Reply with yours.
```

> 🇧🇷 Como os seus agentes pagam por APIs hoje?
>
> • uma chave numa variável de ambiente
> • uma conta pré-paga por API
> • não pagam, um humano paga
> • outra coisa
>
> Pergunta sincera. Responda com a sua.

## Dia 04 · quinta-feira, 12/11/2026 · O ensaio antes de assinar

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 04]

Before AgentGuard signs anything, it rehearses the exact payment and looks at what it would really do, not what the agent says it does.
```

> 🇧🇷 [VIDEO DAY 04]
>
> Antes de assinar qualquer coisa, o AgentGuard ensaia o pagamento exato e olha o que ele faria de verdade, não o que o agente diz que ele faz.

### 12:00 BRT (15:00 UTC) · Thread: vinte formas de dizer não · 1/7

```text
AgentGuard has twenty named ways to refuse a payment.

Each refusal carries its code, so you, your agent and the audit log all know exactly why. Here is what they catch. 🧵
```

> 🇧🇷 O AgentGuard tem vinte formas nomeadas de recusar um pagamento.
>
> Cada recusa leva seu código, então você, seu agente e o log de auditoria sabem exatamente por quê. Veja o que elas pegam. 🧵

### 12:00 BRT (15:00 UTC) · Thread: vinte formas de dizer não · 2/7

```text
Policy first. A new agent denies everything.

PAUSED, CHAIN_NOT_ALLOWED, TOKEN_NOT_ALLOWED, RECIPIENT_NOT_ALLOWED, DOMAIN_NOT_ALLOWED, PER_TX_EXCEEDED, DAILY_EXCEEDED.

Any doubt means no.
```

> 🇧🇷 Primeiro a política. Um agente novo nega tudo.
>
> PAUSED, CHAIN_NOT_ALLOWED, TOKEN_NOT_ALLOWED, RECIPIENT_NOT_ALLOWED, DOMAIN_NOT_ALLOWED, PER_TX_EXCEEDED, DAILY_EXCEEDED.
>
> Qualquer dúvida significa não.

### 12:00 BRT (15:00 UTC) · Thread: vinte formas de dizer não · 3/7

```text
Then the simulation. SIM_FAILED if the exact transfer would not go through. SIM_UNEXPECTED_EFFECT if it would do anything beyond moving that amount to that recipient.

On EVM, both balances must move by exactly the amount.
```

> 🇧🇷 Depois a simulação. SIM_FAILED se a transferência exata não passaria. SIM_UNEXPECTED_EFFECT se ela fizesse qualquer coisa além de mover aquele valor para aquele destinatário.
>
> Em EVM, os dois saldos precisam mudar exatamente pelo valor.

### 12:00 BRT (15:00 UTC) · Thread: vinte formas de dizer não · 4/7

```text
EVM-specific: the hot wallet signs only TransferWithAuthorization, after every field is checked.

Anything else is refused: APPROVAL_DETECTED (approve, setApprovalForAll), PERMIT_DETECTED (Permit, Permit2), DELEGATION_DETECTED (EIP-7702).
```

> 🇧🇷 Específico de EVM: a hot wallet só assina TransferWithAuthorization, depois de cada campo ser conferido.
>
> Qualquer outra coisa é recusada: APPROVAL_DETECTED (approve, setApprovalForAll), PERMIT_DETECTED (Permit, Permit2), DELEGATION_DETECTED (EIP-7702).

### 12:00 BRT (15:00 UTC) · Thread: vinte formas de dizer não · 5/7

```text
Solana-specific: DELEGATE_DETECTED (SPL Approve), AUTHORITY_CHANGE_DETECTED (SetAuthority), ACCOUNT_CLOSE_DETECTED (CloseAccount), UNKNOWN_PROGRAM_DETECTED, and HIDDEN_ACCOUNTS_DETECTED for lookup tables that obscure touched accounts.
```

> 🇧🇷 Específico de Solana: DELEGATE_DETECTED (SPL Approve), AUTHORITY_CHANGE_DETECTED (SetAuthority), ACCOUNT_CLOSE_DETECTED (CloseAccount), UNKNOWN_PROGRAM_DETECTED, e HIDDEN_ACCOUNTS_DETECTED para lookup tables que escondem as contas tocadas.

### 12:00 BRT (15:00 UTC) · Thread: vinte formas de dizer não · 6/7

```text
And the human ones: OWNER_REJECTED when you say no on Telegram, APPROVAL_TIMEOUT when you say nothing. No answer means no payment.

INVALID_402 when a paid API's payment request is malformed.
```

> 🇧🇷 E os humanos: OWNER_REJECTED quando você diz não no Telegram, APPROVAL_TIMEOUT quando você não diz nada. Sem resposta, sem pagamento.
>
> INVALID_402 quando o pedido de pagamento de uma API paga vem malformado.

### 12:00 BRT (15:00 UTC) · Thread: vinte formas de dizer não · 7/7

```text
The full list, with the types and the API, is in the spec. 39 attack cases in the test suite exercise these paths.

https://github.com/agent443-dot/AgentGuard/blob/main/SPEC.md
```

> 🇧🇷 A lista completa, com os tipos e a API, está na spec. 39 casos de ataque na suíte de testes exercitam esses caminhos.
>
> https://github.com/agent443-dot/AgentGuard/blob/main/SPEC.md

### 17:00 BRT (20:00 UTC) · Conversa

```text
If you pointed your current agent at AgentGuard with a deny-all policy, which reject code would it hit first?

My guess for most setups: DOMAIN_NOT_ALLOWED within the first minute.
```

> 🇧🇷 Se você apontasse seu agente atual para o AgentGuard com uma política que nega tudo, qual código de recusa ele bateria primeiro?
>
> Meu palpite para a maioria das configurações: DOMAIN_NOT_ALLOWED no primeiro minuto.

## Dia 05 · sexta-feira, 13/11/2026 · Pagamentos grandes esperam o seu dedo

### 10:30 BRT (13:30 UTC) · Vídeo

```text
[VIDEO DAY 05]

Set a threshold. Anything at or above it lands in your Telegram with what the payment will actually do. One yes, one payment. No answer in 10 minutes, no payment.
```

> 🇧🇷 [VIDEO DAY 05]
>
> Defina um limite de aprovação. Qualquer coisa a partir dele chega no seu Telegram com o que o pagamento vai fazer de verdade. Um sim, um pagamento. Sem resposta em 10 minutos, sem pagamento.

### 13:00 BRT (16:00 UTC) · Visual: a aprovação

```text
What you approve is the effect, not the agent's story.

The Telegram message shows the amount, the domain, the chain and the change to the spending wallet. The agent's reason is shown too, marked unverified.

Your yes covers that one payment, once.
```

> 🇧🇷 O que você aprova é o efeito, não a história do agente.
>
> A mensagem no Telegram mostra o valor, o domínio, a rede e a mudança na carteira de gastos. O motivo do agente também aparece, marcado como não verificado.
>
> Seu sim vale para aquele pagamento, uma vez.

### 15:00 BRT (18:00 UTC) · Bastidores: um bug que encontramos

```text
A bug our own live runs found:

The first payment from an empty hot wallet on Base Sepolia failed with SIM_FAILED. The simulation ran before the top-up from the vault, so it saw nothing to pay with.

Fixed in #63: top up, then simulate. Re-checked live on Solana devnet.
```

> 🇧🇷 Um bug que nossos próprios testes ao vivo encontraram:
>
> O primeiro pagamento a partir de uma hot wallet vazia na Base Sepolia falhou com SIM_FAILED. A simulação rodava antes da recarga vinda do cofre, então não via nada para pagar.
>
> Corrigido no #63: recarrega, depois simula. Conferido de novo ao vivo na devnet da Solana.

### 15:00 BRT (18:00 UTC) · Bastidores: um bug que encontramos · resposta ao seu próprio post

```text
Every bug the live runs found is listed with its fix in the final report. Tests passing on a stub chain did not catch this one. A real chain did.
https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md
```

> 🇧🇷 Todo bug que os testes ao vivo encontraram está listado com a correção no relatório final. Os testes passando numa chain simulada não pegaram este. Uma chain real pegou.
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md

### 17:00 BRT (20:00 UTC) · Conversa

```text
Where would you set the approval threshold for an agent buying API calls?

Our self-host guide suggests starting at: 5 per payment, 20 a day, your approval above 1. Too tight? Too loose?
```

> 🇧🇷 Onde você colocaria o limite de aprovação para um agente que compra chamadas de API?
>
> Nosso guia de self-host sugere começar com: 5 por pagamento, 20 por dia, sua aprovação acima de 1. Apertado demais? Frouxo demais?

## Dia 06 · sábado, 14/11/2026 · O kill switch

### 12:00 BRT (15:00 UTC) · Vídeo

```text
[VIDEO DAY 06]

/kill in Telegram pauses every agent at once. AgentGuard then drafts the transaction that removes each chain's onchain cap. You sign it in Phantom, and the money is shut off.
```

> 🇧🇷 [VIDEO DAY 06]
>
> /kill no Telegram pausa todos os agentes de uma vez. Depois o AgentGuard prepara a transação que remove o limite onchain de cada rede. Você assina na Phantom, e o dinheiro é cortado.

### 16:00 BRT (19:00 UTC) · Visual: o kill, como rodou na mainnet

```text
The kill, as we ran it on Robinhood Chain mainnet:

1. /kill → Confirm: the agent paused
2. Phantom signed removeDelegate on the Safe Allowance Module
3. The page read back "no longer a delegate"

Rule we learned: always start a kill from /kill, not an old button.
```

> 🇧🇷 O kill, do jeito que rodamos na mainnet da Robinhood Chain:
>
> 1. /kill → Confirm: o agente foi pausado
> 2. A Phantom assinou removeDelegate no Safe Allowance Module
> 3. A página confirmou "no longer a delegate" (não é mais delegate)
>
> Regra que aprendemos: sempre comece um kill pelo /kill, não por um botão antigo.

### 16:00 BRT (19:00 UTC) · Visual: o kill, como rodou na mainnet · resposta ao seu próprio post

```text
Why "start from /kill": in a rehearsal, an older "Open kill in Phantom" button removed the onchain limit but left the agent unpaused until /kill → Confirm ran. The runbook now starts every kill from /kill.
```

> 🇧🇷 Por que "começar pelo /kill": num ensaio, um botão antigo "Open kill in Phantom" removeu o limite onchain, mas deixou o agente sem pausa até o /kill → Confirm rodar. O runbook agora começa todo kill pelo /kill.

## Dia 07 · domingo, 15/11/2026 · Riscos conhecidos e a primeira semana

### 12:00 BRT (15:00 UTC) · Vídeo, depois thread

```text
[VIDEO DAY 07]

Every security project has risks. Ours are written down in the final report, with what is still open. Thread below. 🧵
```

> 🇧🇷 [VIDEO DAY 07]
>
> Todo projeto de segurança tem riscos. Os nossos estão escritos no relatório final, com o que ainda está em aberto. Thread abaixo. 🧵

### 12:00 BRT (15:00 UTC) · Vídeo, depois thread · 1/9

```text
AgentGuard's seven known risks, straight from docs/final-report.md.

If you run it, you should know these before you fund a vault.
```

> 🇧🇷 Os sete riscos conhecidos do AgentGuard, direto do docs/final-report.md.
>
> Se você vai rodar, deveria conhecê-los antes de colocar dinheiro num cofre.

### 12:00 BRT (15:00 UTC) · Vídeo, depois thread · 2/9

```text
1. On the Safe chains, a stolen hot key can send the day's cap to any address without guard-core seeing it.

On Solana it can only move the cap into the hot wallet. The loss bound is the same: cap + hot wallet balance.
```

> 🇧🇷 1. Nas redes com Safe, uma chave quente roubada pode enviar o limite do dia para qualquer endereço sem o guard-core ver.
>
> Na Solana ela só consegue mover o limite para a hot wallet. O teto de perda é o mesmo: limite + saldo da hot wallet.

### 12:00 BRT (15:00 UTC) · Vídeo, depois thread · 3/9

```text
2. The owner key is in a software wallet. It can move the whole vault.

So: a fresh Phantom wallet with its own phrase, used for nothing else, and a vault that holds only what agents need for the coming days.
```

> 🇧🇷 2. A chave do dono fica numa carteira de software. Ela pode mover o cofre inteiro.
>
> Por isso: uma carteira Phantom nova, com frase própria, usada para nada mais, e um cofre que guarda só o que os agentes precisam nos próximos dias.

### 12:00 BRT (15:00 UTC) · Vídeo, depois thread · 4/9

```text
3. The signing page is a trust root. Whoever can redeploy it can show a harmless summary of a harmful transaction.

That is why each user deploys their own, from their own protected main, with previews off.
```

> 🇧🇷 3. A página de assinatura é uma raiz de confiança. Quem consegue republicá-la pode mostrar um resumo inofensivo de uma transação perigosa.
>
> Por isso cada usuário publica a sua, a partir do próprio main protegido, com previews desligados.

### 12:00 BRT (15:00 UTC) · Vídeo, depois thread · 5/9

```text
4. Rate limits count per socket address. Behind a proxy, every client shares the proxy's address, so the proxy needs its own per-client limit.
```

> 🇧🇷 4. Os rate limits contam por endereço de socket. Atrás de um proxy, todos os clientes compartilham o endereço do proxy, então o proxy precisa do próprio limite por cliente.

### 12:00 BRT (15:00 UTC) · Vídeo, depois thread · 6/9

```text
5. One process, in-memory rate limits, SQLite. Fine for one guard.

The database is on a persistent volume with daily snapshots, and guard-core refuses an unsafe database location on mainnet. A backup schedule off the volume is still open.
```

> 🇧🇷 5. Um processo, rate limits em memória, SQLite. Suficiente para um guard.
>
> O banco fica num volume persistente com snapshots diários, e o guard-core se recusa a usar um local de banco inseguro na mainnet. Uma rotina de backup fora do volume ainda está em aberto.

### 12:00 BRT (15:00 UTC) · Vídeo, depois thread · 7/9

```text
6. In the lockfile, not reachable from runtime: one high-severity advisory (bigint-buffer, through @solana/spl-token, no patch) and several moderate ones. Each is triaged in docs/security-review.md.
```

> 🇧🇷 6. No lockfile, sem alcance a partir do runtime: um alerta de severidade alta (bigint-buffer, via @solana/spl-token, sem patch) e vários moderados. Cada um está analisado no docs/security-review.md.

### 12:00 BRT (15:00 UTC) · Vídeo, depois thread · 8/9

```text
7. Prompt injection through paid content is limited, not solved.

Tool output marks it as data, and every payment still needs the policy and, above the threshold, you. A model that ignores the marking can still ask to pay. It cannot pay more than the policy allows.
```

> 🇧🇷 7. Prompt injection via conteúdo pago é limitado, não resolvido.
>
> A saída da ferramenta marca isso como dado, e todo pagamento ainda precisa passar pela política e, acima do limite de aprovação, por você. Um modelo que ignore a marcação ainda pode pedir para pagar. Não pode pagar mais do que a política permite.

### 12:00 BRT (15:00 UTC) · Vídeo, depois thread · 9/9

```text
If you see a risk that is not on this list, we want to hear it. Security issues privately, through the repo's Security tab; everything else as an issue.

https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md
```

> 🇧🇷 Se você vir um risco que não está nesta lista, queremos saber. Questões de segurança em privado, pela aba Security do repositório; todo o resto como issue.
>
> https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md

### 16:00 BRT (19:00 UTC) · Resumo da semana

```text
Week one of AgentGuard, plainly:

• Live on Robinhood Chain mainnet, launch cap 20 a day
• Open source, self-hosted, no hosted service
• 895 tests, 39 attack cases
• Next: Solana mainnet, then Base

Thanks for every hard question. Keep them coming.
```

> 🇧🇷 Primeira semana do AgentGuard, sem rodeios:
>
> • No ar na mainnet da Robinhood Chain, limite de lançamento de 20 por dia
> • Open source, self-hosted, sem serviço hospedado
> • 895 testes, 39 casos de ataque
> • Próximos: Solana mainnet, depois Base
>
> Obrigado por cada pergunta difícil. Continuem mandando.
