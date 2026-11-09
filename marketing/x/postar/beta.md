# Lançamento do beta público (v0.1.0-beta), 09/11/2026

Copie o bloco em inglês e cole no X. A tradução em português fica logo abaixo. Conferido com o
GitHub: a tag `v0.1.0-beta`, a seção "Install the beta" do README e uma rodada completa dos testes
na tag (1.294, todos passando).

Ordem: poste a thread e fixe no perfil. Duas a três horas depois, poste o "post curto" como citação
da thread.

---

## Thread (9 posts)

### 1/9

```text
AgentGuard v0.1.0-beta is out.

A payment firewall for AI agents: your agent can pay for things, and it never holds the key.

Live with real money on Robinhood Chain and Solana mainnet. Open source, self-hosted. 🧵
```

> 🇧🇷 O AgentGuard v0.1.0-beta saiu.
>
> Um firewall de pagamentos para agentes de IA: seu agente pode pagar por coisas, e nunca tem a
> chave.
>
> No ar com dinheiro real na mainnet da Robinhood Chain e da Solana. Open source, você mesmo
> hospeda. 🧵

### 2/9

```text
AgentGuard is not another agent. It protects the ones you already run: Claude Code, Claude Desktop, Cursor, any MCP client.

The agent can only ask to pay. AgentGuard checks, decides and signs. One setup command connects your client.
```

> 🇧🇷 O AgentGuard não é mais um agente. Ele protege os que você já usa: Claude Code, Claude
> Desktop, Cursor, qualquer cliente MCP.
>
> O agente só pode pedir para pagar. O AgentGuard confere, decide e assina. Um comando de setup
> conecta o seu cliente.

### 3/9

```text
Every payment passes three gates:

1. your policy: per-payment and daily limits, allowed chains, tokens, recipients and websites
2. a simulation of the exact transfer
3. your approval on Telegram above your threshold

Any doubt means no.
```

> 🇧🇷 Todo pagamento passa por três barreiras:
>
> 1. a sua política: limites por pagamento e por dia, redes, tokens, destinatários e sites
>    permitidos
> 2. uma simulação da transferência exata
> 3. a sua aprovação no Telegram acima do seu limite
>
> Na dúvida, a resposta é não.

### 4/9

```text
Under the gates, a hard ceiling: an onchain daily cap, with no custom contract. Squads v4 on Solana, the Safe Allowance Module on Robinhood Chain.

The worst day is the cap plus the hot wallet balance, even if AgentGuard itself is compromised.
```

> 🇧🇷 Por baixo das barreiras, um teto rígido: um limite diário onchain, sem contrato próprio.
> Squads v4 na Solana, o Safe Allowance Module na Robinhood Chain.
>
> O pior dia é o limite mais o saldo da hot wallet, mesmo que o próprio AgentGuard seja
> comprometido.

### 5/9

```text
New in the beta:

• pinned payees: a new recipient, or more than 2x the last price, waits for you
• a circuit breaker for runaway loops
• task budgets for one job at a time
• shadow mode: new agents pay nothing until you switch them live
```

> 🇧🇷 Novo no beta:
>
> • recebedores fixados: um recebedor novo, ou mais que o dobro do último preço, espera por você
> • um disjuntor para loops descontrolados
> • orçamentos por tarefa, um trabalho de cada vez
> • modo sombra: agentes novos não pagam nada até você colocá-los no ar

### 6/9

```text
You stay in control from your phone:

• /kill, then one Phantom signature per chain
• /report, /doctor, /agent, /policy and /mode in Telegram
• a public proof-of-cap page: anyone can read the most an agent can draw, straight from the chain
```

> 🇧🇷 Você mantém o controle pelo celular:
>
> • /kill, e depois uma assinatura no Phantom por rede
> • /report, /doctor, /agent, /policy e /mode no Telegram
> • uma página pública de prova do limite: qualquer pessoa lê o máximo que um agente pode sacar,
> direto da blockchain

### 7/9

```text
Built in, off until you configure them:

• signed receipts for every executed payment
• passkey approvals above an amount you set: a stolen Telegram account can reject a payment, never approve it
```

> 🇧🇷 Já embutidos, desligados até você configurar:
>
> • recibos assinados para cada pagamento executado
> • aprovação por passkey acima de um valor que você define: uma conta de Telegram roubada pode
> rejeitar um pagamento, nunca aprovar

### 8/9

```text
Plainly: this is a beta.

It has had internal security reviews, but no external audit yet. Only Squads and Safe, the parts it is built on, are audited.

Use small amounts. The default cap is 20 a day, and the signing page refuses more than 50.
```

> 🇧🇷 Sem rodeios: isto é um beta.
>
> Passou por revisões de segurança internas, mas ainda nenhuma auditoria externa. Só o Squads e o
> Safe, as partes sobre as quais ele é construído, são auditados.
>
> Use valores pequenos. O limite padrão é 20 por dia, e a página de assinatura recusa mais de 50.

### 9/9

```text
1,294 automated tests. Apache-2.0. Your own copy, your own vault, your own Phantom wallet. No hosted service.

A setup wizard does the rest, with --dry-run to see every step first.

Release: https://github.com/agent443-dot/AgentGuard/releases/tag/v0.1.0-beta
```

> 🇧🇷 1.294 testes automatizados. Apache-2.0. Sua própria cópia, seu próprio cofre, sua própria
> carteira Phantom. Sem serviço hospedado.
>
> Um assistente de instalação faz o resto, com --dry-run para ver cada passo antes.

Responda ao 9/9 com os links de instalação e do whitepaper (⚠️ só poste depois que docs/whitepaper.md estiver no main):

```text
Install the beta (Portuguese guide in docs/self-host.pt-BR.md):
https://github.com/agent443-dot/AgentGuard#install-the-beta

Technical whitepaper:
https://github.com/agent443-dot/AgentGuard/blob/main/docs/whitepaper.md
```

> 🇧🇷 Instale o beta (guia em português em docs/self-host.pt-BR.md), e o whitepaper técnico.

---

## Post curto (2 a 3 horas depois, citando a thread)

```text
If your agent can spend money, it should not hold the key.

AgentGuard v0.1.0-beta: policy, simulation, Telegram approval and an onchain daily cap, for any MCP agent. Live on Robinhood Chain and Solana. Beta, small amounts, no external audit yet.
```

> 🇧🇷 Se o seu agente pode gastar dinheiro, ele não deveria ter a chave.
>
> AgentGuard v0.1.0-beta: política, simulação, aprovação no Telegram e um limite diário onchain,
> para qualquer agente MCP. No ar na Robinhood Chain e na Solana. Beta, valores pequenos, ainda sem
> auditoria externa.

---

## Respostas prontas para hoje

**"Is it audited?"**

```text
Not externally, not yet. It has had internal security reviews, and the onchain cap uses Squads v4 and the Safe Allowance Module, which are audited. We wrote no contract of our own. That is why it is a beta and we say: small amounts.
```

> 🇧🇷 Externamente, ainda não. Passou por revisões de segurança internas, e o limite onchain usa o
> Squads v4 e o Safe Allowance Module, que são auditados. Não escrevemos nenhum contrato próprio. É
> por isso que é um beta e dizemos: valores pequenos.

**"Can I npm install it?"**

```text
Not yet: the packages aren't on npm. Clone the repo, pnpm install, then run the wizard: pnpm --filter create-agentguard start (add --dry-run to see every step first).
```

> 🇧🇷 Ainda não: os pacotes não estão no npm. Clone o repositório, rode pnpm install e depois o
> assistente: pnpm --filter create-agentguard start (adicione --dry-run para ver cada passo antes).

**"Base?"**

```text
Not live. Base comes next, after its own checks and its own pilot, as Robinhood Chain and Solana had.
```

> 🇧🇷 Não está no ar. A Base vem a seguir, depois das próprias verificações e do próprio piloto,
> como aconteceu com a Robinhood Chain e a Solana.

**"How many users?"**

```text
It's self-hosted, so we can't see who runs it, by design. We won't post numbers we can't back.
```

> 🇧🇷 É hospedado por cada usuário, então não vemos quem usa, de propósito. Não vamos postar números
> que não conseguimos comprovar.
