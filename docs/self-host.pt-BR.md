# Rode o seu próprio AgentGuard

> Tradução de [`self-host.md`](./self-host.md). Se as duas divergirem, vale a versão em inglês. Os
> comandos, as mensagens do bot e a interface são em inglês e aparecem aqui como estão.

O AgentGuard é auto-hospedado. Você roda o seu próprio guard-core e o seu bot do Telegram, o seu
dinheiro fica num cofre que só você controla, e nada no caminho é nosso. Este guia vai de uma conta
vazia até um agente pagando uma API x402 dentro de um limite diário, com um botão de desligar que
funciona.

Se algo der errado, veja [`troubleshooting.md`](./troubleshooting.md) (em inglês).

> **Beta público.** Funciona com dinheiro de verdade, mas ainda não tem auditoria externa. Deixe no
> cofre só o que você pode perder, e mantenha o limite diário baixo.

## O que você precisa

- Node 20+ e pnpm 10. No Windows, WSL2 com Ubuntu, e o repositório clonado em `~`, não em `/mnt/c`.
- Uma conta na [Fly.io](https://fly.io) com cartão cadastrado. Máquinas de teste param depois de 5
  minutos.
- Uma conta na [Vercel](https://vercel.com) para a sua página de assinatura.
- Telegram, e um token de bot do [@BotFather](https://t.me/BotFather).
- **Uma carteira Phantom nova, com a sua própria frase de recuperação, usada só para ser dona dos
  seus cofres.** Essa carteira pode mover tudo o que está neles, então guarde pouco lá.
- Em cada rede: o dólar da rede para o cofre (USDC na Solana, USDG na Robinhood Chain) e um pouco
  da moeda nativa para as taxas.

## O jeito rápido: o assistente

```bash
git clone https://github.com/agent443-dot/AgentGuard.git ~/AgentGuard
cd ~/AgentGuard && pnpm install
pnpm --filter create-agentguard start
```

O assistente faz uma pergunta por vez, quase sempre com uma resposta padrão:

- cria as chaves e as guarda em `~/.agentguard/`;
- cria os apps na Fly e publica a página de assinatura na Vercel;
- mostra cada link para assinar na Phantom e confere o resultado na rede;
- cria o seu primeiro agente em modo sombra (shadow).

Com `--dry-run`, ele mostra todos os comandos e não roda nenhum. Se parar no meio, rode de novo:
ele continua de onde parou. Para conferir uma instalação que já está rodando:
`pnpm --filter create-agentguard start doctor`.

O resto desta página é a mesma instalação feita à mão.

## Como o dinheiro fica protegido

```
Seu cofre (multisig Squads na Solana, Safe nas redes EVM). Só a sua Phantom controla.
  └─ limite diário, garantido na própria rede pelo Squads ou pelo Allowance Module do Safe
       └─ a carteira quente do guard-core, com pouco ou nada
            └─ paga APIs x402, depois da política do agente, de uma simulação e, acima do
               seu limite de aprovação, do seu OK no Telegram
```

O máximo que um dia pode custar é o limite diário mais o que está na carteira quente, mesmo que o
guard-core seja invadido. Deixe no cofre só o que os agentes vão usar nos próximos dias. `/kill` no
Telegram para o guard-core, e uma assinatura na Phantom remove o limite na rede.

## 1. Clonar e conferir

```bash
git clone https://github.com/agent443-dot/AgentGuard.git ~/AgentGuard
cd ~/AgentGuard && pnpm install && pnpm check
```

## 2. Chaves

- **Dona:** a sua Phantom. Ela nunca vai para um arquivo, e você assina só na Phantom, pela sua
  página de assinatura.
- **Carteira quente, uma por rede:** gerada na sua máquina em `~/.agentguard/`, com permissão 0600,
  nunca no repositório. Os comandos mostram só o endereço:
  - Solana: `solana-keygen new -o ~/.agentguard/sol-hot.json`;
  - EVM: o comando de uma linha em [`packages/onchain/README.md`](../packages/onchain/README.md),
    seção Robinhood Chain.
- **Tokens dos serviços:** `openssl rand -hex 32` para cada um de `ADMIN_TOKEN`, `BOT_TOKEN` e
  `BOT_WEBHOOK_SECRET` do guard-core. O bot recebe os mesmos três valores.

Nunca use no mainnet uma chave de devnet ou testnet.

## 3. A sua página de assinatura

A Phantom não roda os nossos scripts, então você assina a criação do cofre e o kill numa página
estática que você mesmo publica. Os endereços das suas carteiras quentes ficam embutidos nela, e um
link não consegue trocá-los. Quem consegue republicar a página consegue mostrar um resumo inofensivo
de uma transação perigosa, então só você deve poder publicá-la.

1. Na Vercel, crie um projeto a partir deste repositório com a pasta raiz `packages/onchain/web`.
   O `vercel.json` só publica a `main` e já define os cabeçalhos de segurança.
2. Variáveis de ambiente, só em Production:
   - `SOLANA_HOT_WALLET_MAINNET` e/ou `ROBINHOOD_HOT_WALLET_MAINNET`: os endereços públicos das suas
     carteiras quentes;
   - `SOLANA_MAINNET_RPC`: uma URL de RPC travada no domínio da sua página (Helius e QuickNode fazem
     isso). A chave fica pública na página, e a trava impede que outros gastem a sua cota;
   - opcional: `MAX_DAILY_CAP`, o maior limite permitido, em unidades base (padrão 50).
3. Publique e confira se a página tem as suas carteiras quentes:
   `curl -s 'https://<sua página>/app.js' | grep -o 'hot:"[^"]*"'`.

## 4. Os seus cofres

Abra cada link num navegador com a extensão da Phantom, na conta dona. Antes de aprovar, confira o
que a página e a Phantom mostram.

**Solana**

1. `https://<sua página>/?action=create&cluster=mainnet-beta` cria o multisig Squads, com a sua
   carteira como autoridade de configuração. O Squads cobra uma taxa de criação, e a página mostra.
2. Mande USDC para o endereço do cofre (vault) que a página mostra. O cofre não é o endereço do
   multisig.
3. `/?action=add-limit&cluster=mainnet-beta&multisig=<multisig>&amount=<limite em unidades base>`
   define o limite diário, com a carteira quente como único membro e único destino.

**Robinhood Chain**

1. `/?action=create&cluster=robinhood` cria o Safe, com a sua carteira como única dona.
2. Mande USDG para o Safe. Confira que o token é `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`:
   outros tokens naquela rede usam o mesmo nome.
3. `/?action=enable&cluster=robinhood&safe=<Safe>&amount=<limite em unidades base>` liga o
   Allowance Module e define o limite da carteira quente.

Confira cada um antes de seguir, em `packages/onchain`: `pnpm status:robinhood` para a Robinhood
Chain e `pnpm status` para a Solana. Cada um mostra a dona, o limite e o saldo.

Mande um pouco da moeda nativa para cada carteira quente: nas redes EVM, ela paga o gás para sacar
do Safe.

## 5. guard-core e o bot na Fly

Os nomes de app na Fly são globais, então escolha os seus e altere:

- `app` em `packages/guard-core/fly.toml`;
- `app` em `packages/telegram-bot/fly.toml`;
- as duas URLs privadas que apontam uma para a outra: `BOT_URL` no `fly.toml` do guard-core e
  `GUARD_URL` no do bot.

Depois siga, nesta ordem:

1. "Deploy on Fly.io" em [`packages/guard-core/README.md`](../packages/guard-core/README.md): crie o
   app e o volume, defina as configurações com `fly secrets import`, passe cada chave quente direto
   do arquivo, e publique uma máquina. No mainnet, defina `SOLANA_CHAIN`, porque o padrão é devnet.
2. "Deploy on Fly.io" em [`packages/telegram-bot/README.md`](../packages/telegram-bot/README.md), com
   `SIGN_PAGE_URL` apontando para a sua página.
3. Confira: `/status` no Telegram lista cada rede com o seu limite.

Só as rotas de agente do guard-core são públicas. As rotas de admin ficam na rede privada da Fly, e
você chega nelas com `fly proxy 18787:8787 --app <seu app guard-core>`.

Para publicar a cada merge na sua `main`, mantenha `.github/workflows/deploy.yml`, troque os dois
nomes de app na matriz, e adicione `FLY_API_TOKEN_GUARD` e `FLY_API_TOKEN_BOT` como **secrets**,
nunca como variáveis. Crie cada um com `fly tokens create deploy -a <app>`.

## Rodar em qualquer servidor, em vez da Fly

O `docker-compose.yml` na raiz roda as mesmas duas imagens em qualquer servidor com Docker. As rotas
de admin e do bot ficam na rede do compose, e as rotas de agente escutam só em `127.0.0.1:8080`.

1. Coloque as configurações dos dois apps em `~/.agentguard/compose.env`, com permissão 0600. São os
   mesmos nomes do `fly secrets import`.
2. `docker compose --env-file ~/.agentguard/compose.env up -d --build`.
3. Para agentes em outras máquinas, aponte um nome DNS para o servidor e adicione o Caddy, que
   obtém o certificado sozinho:
   `DOMAIN=guard.example.com docker compose --env-file ~/.agentguard/compose.env --profile tls up -d --build`.
   Nunca publique a porta 8080 direto.

## 6. Agentes

1. Crie um agente pelo assistente, ou no Telegram com `/agent new <id>` quando o bot tiver esse
   comando, ou na máquina:
   `fly ssh console --app <app guard-core> -C "sh -c 'cd /srv/agentguard/packages/guard-core && node --import tsx src/scripts/create-agent.ts <id-do-agente>'"`.
   O token do agente aparece uma única vez.
2. Um agente novo começa em modo sombra: o guard-core avalia cada pagamento e não paga nenhum.
   A política começa negando tudo. Uma boa primeira política: 5 por pagamento, 20 por dia, a sua
   aprovação acima de 1, e só os domínios de API em que você confia. Os campos estão em
   [`SPEC.md`](../SPEC.md).
3. Conecte o agente: "For agent builders" em
   [`packages/mcp-server/README.md`](../packages/mcp-server/README.md).

## 7. Antes de confiar

Faça cada um destes uma vez, na sua instalação:

- **Um pagamento pequeno:** alguns centavos para uma API x402 sua. `e2e/src/evm-paywall.ts` e
  `devnet-paywall.ts` são APIs pagas que você pode rodar.
- **O kill:** `/kill` e Confirm no Telegram, depois o botão da Phantom de cada rede, e então
  `/status` mostra que não há mais limite na rede.
- **Uma restauração:** `db:backup` na máquina, copie o arquivo com `fly ssh sftp get`, e
  `pnpm --filter @agentguard/e2e restore-drill <arquivo>` mostra que as políticas e o gasto do dia
  voltam.

O roteiro completo de incidentes, incluindo a troca de chaves, está na §4 de
[`LAUNCH.md`](../LAUNCH.md), em inglês.
