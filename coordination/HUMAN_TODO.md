# Tarefas do dono (só tu podes fazer)

Este ficheiro é escrito **só pelo manager** e é o único documento do repositório em português, porque é
dirigido a ti. As outras sessões não falam contigo diretamente: se precisarem de algo teu, deixam um
recado em `coordination/messages/manager/` e eu peço-te.

**Regra de ouro: nunca coles chaves privadas no chat.** Geras a chave na tua máquina e colas tu mesmo no
ficheiro `.env` do pacote certo. O `.gitignore` já ignora todos os `.env`.

Estado: ✅ feito · ⏳ a aguardar-te · ⬜ ainda não é preciso

---

## ✅ HUMAN-1 — Criar o repositório e dar-me acesso

Feito. O repositório é `kikume/AgentGuard` e esta sessão já tem acesso de escrita.

---

## ⏳ HUMAN-2 — Instalar o Foundry (5 min)

Desbloqueia: `ON-6` (os testes onchain que provam o limite de gasto) e o comando `cast`, que usamos
no passo seguinte para criar as carteiras.

1. Abre um terminal e corre:
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   ```
2. Fecha e reabre o terminal (ou corre `source ~/.bashrc` / `source ~/.zshrc`).
3. Corre:
   ```bash
   foundryup
   ```
4. Confirma que ficou instalado:
   ```bash
   forge --version && cast --version
   ```

Diz-me o que o último comando imprimiu.

---

## ⏳ HUMAN-3 — Criar as duas carteiras de teste

Desbloqueia: correr o `ON-1` e o `ON-2` (criar a Safe e ligar o limite de gasto).

São duas carteiras novas, **só para testnet**. Não reutilizes nenhuma carteira que já tenha dinheiro real.

- **Owner EOA** — é a dona da Safe. É quem aprova mudanças e quem carrega no botão do kill switch.
- **Guard hot wallet** — é a carteira que o serviço Guard usa para pagar. Fica sempre com pouco dinheiro.

1. Cria a primeira:
   ```bash
   cast wallet new
   ```
   Guarda o `Address` e o `Private key` num gestor de senhas. Esta é a **owner EOA**.
2. Corre outra vez para a segunda:
   ```bash
   cast wallet new
   ```
   Esta é a **guard hot wallet**.
3. Preenche os ficheiros `.env` (copia primeiro o exemplo ao lado de cada um):
   - `packages/onchain/.env`:
     - `OWNER_PRIVATE_KEY=` chave privada da **owner EOA**
     - `HOT_WALLET_ADDRESS=` **endereço** da hot wallet (aqui só o endereço, não a chave)
     - `BASE_SEPOLIA_RPC_URL=https://sepolia.base.org`
   - `packages/guard-core/.env`:
     - `HOT_WALLET_PRIVATE_KEY=` chave privada da **hot wallet**
     - `BASE_SEPOLIA_RPC_URL=https://sepolia.base.org`

   A chave da hot wallet existe num só sítio: o `.env` do `guard-core`. É de propósito.

4. Diz-me os **dois endereços** (endereços públicos podem ser ditos no chat; chaves privadas nunca).

> Nota: o RPC público `https://sepolia.base.org` serve para começar. Para os testes de fork do Foundry
> um RPC dedicado (Alchemy ou QuickNode, plano grátis) é bem mais rápido. Se quiseres, trata disso
> quando o `ON-6` começar a ser lento e eu digo-te onde pôr o URL.

---

## ⬜ HUMAN-4 — Pôr fundos de teste nas duas carteiras

Depois do HUMAN-3. Precisas de ETH de Base Sepolia (para gás) nas duas carteiras, e de USDC de teste na
**owner EOA** (é a Safe que vai guardar o dinheiro).

1. ETH de teste: faucet da Base Sepolia no Coinbase Developer Platform
   (`portal.cdp.coinbase.com`, secção Faucets) ou outra faucet de Base Sepolia. Pede para os dois endereços.
2. USDC de teste: faucet oficial da Circle em `faucet.circle.com`, escolhe a rede **Base Sepolia**.
   Pede para o endereço da **owner EOA**.
3. Confirma os saldos:
   ```bash
   cast balance <ENDERECO> --rpc-url https://sepolia.base.org
   ```
4. Diz-me quando estiver feito.

---

## ⬜ HUMAN-5 — Criar o bot do Telegram

Desbloqueia: `BOT-3` (testar as aprovações a sério) e, mais tarde, `INT-4`.

1. No Telegram, fala com o [@BotFather](https://t.me/BotFather) e envia `/newbot`. Escolhe um nome e um
   username. Ele devolve um token no formato `123456789:AA...`.
2. Descobre o teu próprio ID de utilizador: fala com o [@userinfobot](https://t.me/userinfobot) e ele
   diz-te o número.
3. Em `packages/telegram-bot/.env`:
   - `TELEGRAM_BOT_TOKEN=` o token do BotFather
   - `OWNER_TELEGRAM_IDS=` o teu número de utilizador
   - `BOT_WEBHOOK_SECRET=` um segredo aleatório — gera com `openssl rand -hex 32`
4. O **mesmo** valor de `BOT_WEBHOOK_SECRET` tem de estar em `packages/guard-core/.env`.
5. Diz-me quando estiver feito. O token não me mostres; só preciso de saber que está lá.

---

## ⬜ HUMAN-6 — (opcional) Conta Tenderly

Melhora a simulação de transações. Sem isto, o `guard-core` simula com `eth_call`, que já funciona.

Se quiseres: cria conta em `tenderly.co`, cria um projeto, gera uma access key e preenche
`TENDERLY_ACCOUNT_SLUG`, `TENDERLY_PROJECT_SLUG` e `TENDERLY_ACCESS_KEY` em `packages/guard-core/.env`.

---

## ⬜ HUMAN-7 — Contas de deploy

Só quando o `INT-3` estiver pronto. Vamos precisar de alojar o `guard-core` e o `telegram-bot`
(Fly.io ou Railway) e de um gestor de segredos para a chave da hot wallet. Eu digo-te exatamente o que
criar quando chegarmos lá.

---

## ⬜ HUMAN-8 — Decisão e assinatura de mainnet

O último passo, e é inteiramente teu: decidir se passamos a dinheiro real, com que teto diário, e
assinar as transações da Safe em mainnet. Antes disso tens de ter em mão o relatório final do `INT-8`
e o `LAUNCH.md`. Não avanço para aqui sem a tua decisão escrita.
