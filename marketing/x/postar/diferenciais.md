# Diferenciais: posts novos (atualizados com o GitHub de 09/11/2026)

Copie o bloco em inglês e cole no X. A tradução em português fica logo abaixo, só para você saber o
que está postando. Tudo aqui está no `main` do repositório, com testes. Onde uma função existe no
código mas ainda depende de você configurar no seu deploy, o post fala "no código", não "no ar".

Ordem sugerida: a thread primeiro (fixe no lugar da de lançamento, ou logo abaixo dela), depois um
post avulso por dia, no horário principal (10:30 de Brasília).

---

## Thread: um firewall de pagamentos para qualquer agente (8 posts)

### 1/8

```text
AgentGuard is not another AI agent.

It is a payment firewall for the agents you already run: Claude Code, Claude Desktop, Cursor, anything that speaks MCP.

Your agent asks to pay. AgentGuard decides. The agent never holds a key. 🧵
```

> 🇧🇷 O AgentGuard não é mais um agente de IA.
>
> É um firewall de pagamentos para os agentes que você já usa: Claude Code, Claude Desktop, Cursor,
> qualquer um que fale MCP.
>
> Seu agente pede para pagar. O AgentGuard decide. O agente nunca tem a chave. 🧵

### 2/8

```text
The common shortcut: put a wallet key in the agent's environment and hope the prompt never goes wrong.

AgentGuard removes the key from the agent entirely. It can only ask, through five MCP tools. Only guard-core signs, and only after the checks pass.
```

> 🇧🇷 O atalho comum: colocar a chave de uma carteira no ambiente do agente e torcer para o prompt
> nunca dar errado.
>
> O AgentGuard tira a chave do agente por completo. Ele só pode pedir, por cinco ferramentas MCP. Só o
> guard-core assina, e só depois que as verificações passam.

### 3/8

```text
Every payment passes the same gates:

• a deny-all policy: per-payment and daily limits, allowed chains, tokens, recipients, websites
• a simulation of the exact transfer
• your approval on Telegram above your threshold

Any doubt means no.
```

> 🇧🇷 Todo pagamento passa pelas mesmas barreiras:
>
> • uma política que nega tudo por padrão: limites por pagamento e por dia, redes, tokens,
> destinatários e sites permitidos
> • uma simulação da transferência exata
> • sua aprovação no Telegram acima do seu limite
>
> Na dúvida, a resposta é não.

### 4/8

```text
The part a firewall alone can't give you: a loss bound enforced onchain.

The most a day can cost is the daily cap plus what sits in the hot wallet, even if guard-core itself is compromised. Squads or the Safe Allowance Module enforce it. No contract of ours.
```

> 🇧🇷 A parte que um firewall sozinho não te dá: um limite de perda garantido onchain.
>
> O máximo que um dia pode custar é o limite diário mais o que estiver na hot wallet, mesmo que o
> próprio guard-core seja comprometido. Quem garante isso é o Squads ou o Safe Allowance Module.
> Nenhum contrato nosso.

### 5/8

```text
New in the code: it watches the APIs too.

AgentGuard remembers who each website was paid and how much. If the payee changes, or the price more than doubles, it asks you, even below your threshold.

That is what a swapped or compromised API looks like.
```

> 🇧🇷 Novo no código: ele também vigia as APIs.
>
> O AgentGuard lembra para quem cada site recebeu e quanto. Se o recebedor muda, ou o preço mais
> que dobra, ele te pergunta, mesmo abaixo do seu limite de aprovação.
>
> É assim que uma API trocada ou comprometida aparece.

### 6/8

```text
And it watches the agent:

• a circuit breaker: more than 10 payments in a minute and the agent is paused, you're alerted
• task budgets: a budget, websites and an expiry for one job
• shadow mode: new agents start in shadow and pay nothing
```

> 🇧🇷 E vigia o agente:
>
> • um disjuntor: mais de 10 pagamentos em um minuto e o agente é pausado, e você recebe um alerta
> • orçamentos por tarefa: um orçamento, sites e um prazo para um único trabalho
> • modo sombra: agentes novos começam em modo sombra e não pagam nada

### 7/8

```text
Live on Robinhood Chain and Solana mainnet. A real-money pilot ran on Robinhood Chain, and the kill was rehearsed live on Solana: /kill, one Phantom signature, no onchain limit left.

1,293 automated tests pass on main today.
```

> 🇧🇷 No ar na mainnet da Robinhood Chain e da Solana. Um piloto com dinheiro real rodou na
> Robinhood Chain, e o kill foi ensaiado ao vivo na Solana: /kill, uma assinatura no Phantom, e
> nenhum limite onchain restou.
>
> 1.293 testes automatizados passam no main hoje.

### 8/8

```text
Open source, Apache-2.0, self-hosted. Nothing in the money path belongs to us.

Plug your agent in, read every line, and tell us what you break.

https://github.com/agent443-dot/AgentGuard
```

> 🇧🇷 Open source, Apache-2.0, você mesmo hospeda. Nada no caminho do dinheiro pertence a nós.
>
> Conecte seu agente, leia cada linha e conte para a gente o que você conseguir quebrar.

---

## Posts avulsos (um por dia)

### Solana no ar

```text
AgentGuard is now live on Solana mainnet too.

The daily cap is a Squads v4 Spending Limit with the hot wallet as its only member and only destination. We rehearsed the kill live: /kill, one Phantom signature, and the limit was gone.
```

> 🇧🇷 O AgentGuard agora também está no ar na mainnet da Solana.
>
> O limite diário é um Spending Limit do Squads v4, com a hot wallet como único membro e único
> destino. Ensaiamos o kill ao vivo: /kill, uma assinatura no Phantom, e o limite sumiu.

### Funciona com o agente que você já tem

```text
You don't switch agents to use AgentGuard. You plug it in.

One command prints the exact setup for Claude Code, Claude Desktop, Cursor or any MCP client, with your guard's URL filled in. The agent token is read from a hidden prompt, never from the command line.
```

> 🇧🇷 Você não troca de agente para usar o AgentGuard. Você conecta.
>
> Um comando imprime a configuração exata para Claude Code, Claude Desktop, Cursor ou qualquer
> cliente MCP, com a URL do seu guard já preenchida. O token do agente é lido de um campo oculto,
> nunca da linha de comando.

### Modo sombra

```text
Would you give an agent money before seeing how it spends?

New agents in AgentGuard start in shadow mode. Every payment runs the policy and the simulation, then stops: nothing is signed. You see what it would have spent, then decide to go live.
```

> 🇧🇷 Você daria dinheiro a um agente antes de ver como ele gasta?
>
> Agentes novos no AgentGuard começam em modo sombra. Cada pagamento passa pela política e pela
> simulação, e para ali: nada é assinado. Você vê quanto ele teria gastado e só então decide colocar
> no ar.

### API trocada (pinning)

```text
What if the API your agent pays every day starts sending payments somewhere else?

AgentGuard pins each website's payee and price. A new payee, or a price more than double the last one, goes to you for approval, even below your threshold.
```

> 🇧🇷 E se a API que seu agente paga todo dia começar a mandar os pagamentos para outro lugar?
>
> O AgentGuard fixa o recebedor e o preço de cada site. Um recebedor novo, ou um preço mais que o
> dobro do último, vai para você aprovar, mesmo abaixo do seu limite.

### Disjuntor

```text
An agent stuck in a loop can pay the same API a hundred times before anyone notices.

AgentGuard's circuit breaker: by default, the payment that would make more than 10 in a minute is refused, the agent is paused, and you get an alert. It stays paused until you resume it.
```

> 🇧🇷 Um agente preso num loop pode pagar a mesma API cem vezes antes de alguém perceber.
>
> O disjuntor do AgentGuard: por padrão, o pagamento que passaria de 10 em um minuto é recusado, o
> agente é pausado e você recebe um alerta. Ele fica pausado até você retomar.

### Orçamento por tarefa

```text
Give an agent a job, not a blank check.

With task budgets, the agent opens a budget for one task: how much, which websites, how many minutes. Every payment must fit the budget and your policy. Above your threshold, you approve the budget itself.
```

> 🇧🇷 Dê ao agente um trabalho, não um cheque em branco.
>
> Com orçamentos por tarefa, o agente abre um orçamento para uma tarefa: quanto, quais sites,
> quantos minutos. Todo pagamento precisa caber no orçamento e na sua política. Acima do seu limite,
> você aprova o próprio orçamento.

### Passkey

```text
What if someone takes over your Telegram?

Set an amount, and every payment above it needs your passkey, not just a tap. A stolen Telegram account can still reject a payment, never approve it. Once you have one, no one can add another without it.
```

> 🇧🇷 E se alguém tomar o seu Telegram?
>
> Defina um valor, e todo pagamento acima dele exige a sua passkey, não só um toque. Uma conta de
> Telegram roubada ainda pode rejeitar um pagamento, nunca aprovar. Depois que você tem uma, ninguém
> adiciona outra sem ela.

### Recibos assinados

```text
Every payment AgentGuard executes can get a signed receipt: the payment, a hash of the policy it cleared, the simulation, and who approved it.

Signed with Ed25519, by a key separate from the wallets. The public key is published, so anyone can check a receipt.
```

> 🇧🇷 Todo pagamento que o AgentGuard executa pode ganhar um recibo assinado: o pagamento, um hash da
> política que ele cumpriu, a simulação e quem aprovou.
>
> Assinado com Ed25519, por uma chave separada das carteiras. A chave pública é publicada, então
> qualquer pessoa pode conferir um recibo.

### Prova do limite

```text
Don't trust us. Check the chain.

The signing page has a read-only proof: no wallet, no signature. It reads the vault and shows the most this agent can draw in the next 24 hours, who owns the vault, and when the cap resets.
```

> 🇧🇷 Não confie na gente. Confira na blockchain.
>
> A página de assinatura tem uma prova só de leitura: sem carteira, sem assinatura. Ela lê o cofre
> e mostra o máximo que esse agente pode sacar nas próximas 24 horas, quem é o dono do cofre e
> quando o limite reinicia.

### Tudo pelo Telegram

```text
Running AgentGuard no longer needs a terminal for day-to-day work.

From Telegram: create and revoke agents, apply a policy preset, allow or deny a website, switch shadow and live, get a weekly /report, and run /doctor to check the whole setup.
```

> 🇧🇷 Operar o AgentGuard no dia a dia não precisa mais de terminal.
>
> Pelo Telegram: criar e revogar agentes, aplicar um preset de política, permitir ou bloquear um
> site, alternar entre sombra e ao vivo, receber um /report semanal e rodar /doctor para checar toda
> a configuração.

### Assistente de instalação

```text
Self-hosting used to take an afternoon of Fly, Vercel and keys by hand.

The new setup wizard asks one question at a time, generates the hot keys on your machine, deploys your guard, bot and signing page, then waits and reads your vault back. --dry-run prints every step first.
```

> 🇧🇷 Hospedar por conta própria levava uma tarde de Fly, Vercel e chaves feitas à mão.
>
> O novo assistente de instalação faz uma pergunta por vez, gera as hot wallets na sua máquina,
> publica seu guard, seu bot e sua página de assinatura, e depois espera e confere o seu cofre.
> O --dry-run mostra cada passo antes.

### Os números, sem enfeite

```text
AgentGuard today, by the repository:

• live on Robinhood Chain and Solana mainnet
• 1,293 automated tests passing on main
• 39 attack cases
• 0 custom smart contracts
• 0 keys held by the agent
• 1 /kill to stop it all
```

> 🇧🇷 O AgentGuard hoje, segundo o repositório:
>
> • no ar na mainnet da Robinhood Chain e da Solana
> • 1.293 testes automatizados passando no main
> • 39 casos de ataque
> • 0 contratos inteligentes próprios
> • 0 chaves nas mãos do agente
> • 1 /kill para parar tudo
