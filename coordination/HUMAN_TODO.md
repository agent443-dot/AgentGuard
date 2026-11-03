# Tarefas do dono (só tu podes fazer)

Este ficheiro é escrito **só pelo manager** e é o único documento do repositório em português, porque é
dirigido a ti. As outras sessões não falam contigo diretamente: se precisarem de algo teu, deixam um
recado em `coordination/messages/manager/` e eu peço-te.

**Ambiente (confirmado em 2026-11-03):** Windows com **WSL2 + Ubuntu**, shell **zsh** com
oh-my-zsh e Powerlevel10k. Node 22.23.4, pnpm 10.28.0, Foundry 1.9.0, repo em `~/AgentGuard`. Todos os
comandos deste ficheiro correm **dentro do Ubuntu**, nunca em PowerShell nem em Cmd. Abre as sessões do
Claude Code também de dentro do Ubuntu.

**Regra de ouro: nada que autentique ou assine passa pelo chat.** Isso inclui chaves privadas, mas
também `ADMIN_TOKEN`, `BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, o token do BotFather e qualquer access key.
Geras o valor na tua máquina e colas tu mesmo no `.env` do pacote certo; o manager só precisa de saber
que ficou preenchido, nunca o valor. **Endereços públicos podem ser ditos à vontade.**

Se um segredo escapar para o chat, para um log ou para uma captura de ecrã, trata-o como queimado e
gera outro — é um comando, e é sempre mais barato do que a alternativa. O `.gitignore` já ignora todos
os `.env`.

Estado: ✅ feito · ⏳ a aguardar-te · ⬜ ainda não é preciso

---

## ✅ HUMAN-1 — Criar o repositório e dar-me acesso

Feito. O repositório é `kikume/AgentGuard` e esta sessão já tem acesso de escrita. O branch `main` já
existe e é a base de onde as sessões abrem os `feat/<role>`.

---

## ✅ HUMAN-2 — Preparar o ambiente: WSL2, Node, pnpm e Foundry

Feito. `pnpm check` passa na máquina do dono. Os passos ficam registados abaixo porque são a
referência para reconstruir o ambiente, e porque apanharam três coisas que não eram óbvias: a shell é
zsh (não bash), o instalador do Foundry não trata do PATH do zsh, e o repositório é privado.

### 2.1 Ver se o Ubuntu já está instalado

No PowerShell:

```powershell
wsl --list --verbose
```

- Se aparecer `Ubuntu` com `VERSION 2`, está feito — salta para o 2.2.
- Se aparecer `Ubuntu` com `VERSION 1`, converte-o: `wsl --set-version Ubuntu 2`.
- Se não aparecer nada, instala-o num **PowerShell como Administrador** (botão direito no menu
  Iniciar → Terminal (Admin)) com `wsl --install -d Ubuntu` e reinicia o PC se ele pedir.

Se o `wsl --install` responder `ERROR_ALREADY_EXISTS`, significa que já o tens — não é um erro a
corrigir.

### 2.2 Entrar no Ubuntu (o passo que é fácil esquecer)

Este é o passo mais importante da lista. No PowerShell:

```powershell
wsl -d Ubuntu
```

Na primeira vez pede um nome de utilizador e uma password. Essa password é a do `sudo` dentro do
Ubuntu, não tem nada a ver com a password do Windows — escolhe uma de que te lembres.

**Como sabes que entraste:** o prompt deixa de ser `PS C:\Users\joaod>` e passa a ser algo como
`joaod@DESKTOP-XXXX:~$`. Se ainda vês `PS` e `C:\`, estás em PowerShell e os comandos a seguir vão
falhar com `The token '&&' is not a valid statement separator`.

A partir daqui, **todos os comandos correm nesta janela do Ubuntu.** Para sair, `exit`.

### 2.3 Ver o que já está instalado

O Ubuntu do dono não é novo (tem oh-my-zsh e git), por isso **verifica antes de instalar**. Instalar o
Node por cima de um `nvm` existente, por exemplo, dá conflitos chatos de diagnosticar.

Primeiro vai para a home do Linux, não para `/mnt/c`:

```bash
cd ~ && pwd
```

Tem de dizer `/home/<o-teu-utilizador>`. Depois:

```bash
node -v; pnpm -v; git --version; forge --version; echo "---"; command -v nvm fnm
```

Os `;` são de propósito: assim os que faltam falham sem parar os restantes. Salta os passos de
instalação do que já estiver presente e na versão certa (Node >= 20, pnpm 10).

### 2.4 Atualizar o Ubuntu e instalar o git

```bash
sudo apt update && sudo apt upgrade -y && sudo apt install -y git curl build-essential
```

### 2.5 Instalar o pnpm

```bash
sudo corepack enable pnpm
```

```bash
pnpm -v
```

Deve dizer `10.28.0` — o `packageManager` no `package.json` fixa a versão e o corepack respeita-a. Se o
corepack falhar, usa em alternativa `sudo npm install -g pnpm@10.28.0`.

### 2.5b Subir o Node para a 22

O `engines` do projeto pede Node >= 20 e a 20 funciona, mas a linha 20 chegou a fim de vida em abril de
2026: deixou de receber correções de segurança. Para um serviço que assina pagamentos isso não serve, e
o `.nvmrc` e o CI já usam a 22.

O Node do dono está confirmado como `20.20.2-1nodesource1` em `/usr/bin/node`, ou seja, instalado pelo
NodeSource. O upgrade é só apontar o repositório para a linha 22 e reinstalar o mesmo pacote:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```bash
sudo apt install -y nodejs && node -v
```

Se um dia o `which node` apontar para fora de `/usr/bin` (um `nvm` ou um `fnm`, por exemplo), não uses
o NodeSource: faz o upgrade pelo gestor de versões que estiver a mandar, senão ficas com duas
instalações a competir.

### 2.6 Instalar o Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
```

Isto já instala os binários em `~/.foundry/bin` e corre o `foundryup` sozinho. Confirma que a saída diz
`verified ✓` para o `forge` e o `cast` — as binárias são verificadas contra uma atestação Sigstore.

**O PATH não fica tratado.** O `curl | bash` corre o instalador sob bash, por isso ele escreve a linha
do PATH num ficheiro de bash, e **a shell do dono é zsh**, que nunca o lê. Nem `source ~/.bashrc` nem
`exec zsh` resolvem isso. Acrescenta o PATH ao `~/.zshenv`, que é o ficheiro que o zsh lê sempre:

```bash
grep -q '.foundry/bin' ~/.zshenv 2>/dev/null || echo 'export PATH="$HOME/.foundry/bin:$PATH"' >> ~/.zshenv
```

O `grep ||` torna o comando repetível: se a linha já existir, não a duplica. Depois recarrega e confirma:

```bash
exec zsh
```

```bash
forge --version; cast --version
```

### 2.7 Autenticar no GitHub

O repositório é privado, por isso o `git clone` por HTTPS vai pedir credenciais — e o GitHub já não
aceita a password da conta, só um token. O GitHub CLI resolve isto e também configura o git:

```bash
sudo apt install -y gh
```

```bash
gh auth login
```

É interativo. As respostas são: `GitHub.com` → `HTTPS` → `Y` para autenticar o git com as credenciais
do GitHub → `Login with a web browser`. Ele mostra um código de 8 caracteres e abre o browser no
Windows; cola lá o código. Se o browser não abrir, escolhe `Paste an authentication token` e cria um
token em `github.com/settings/tokens` com o âmbito `repo`.

### 2.8 Clonar o repositório dentro do Ubuntu

Importante: clona dentro do sistema de ficheiros do Linux (`~`), **não** em `/mnt/c/...`. Em `/mnt/c` o
pnpm e o git ficam muito lentos.

```bash
cd ~ && git clone https://github.com/kikume/AgentGuard.git && cd AgentGuard
```

### 2.9 Verificar que tudo funciona

```bash
cd ~/AgentGuard && pnpm -v
```

Na primeira vez o corepack pode pedir confirmação para descarregar o pnpm `10.28.0` — responde `Y`. A
versão vem fixa do `packageManager` no `package.json`, por isso é a mesma em todas as máquinas e no CI.

```bash
pnpm install
```

```bash
pnpm check
```

Tem de passar `lint`, `format:check`, `typecheck` e `test`. Diz-me o resultado.

> Se usas VS Code, instala a extensão **WSL** e abre o projeto com `code .` de dentro do Ubuntu.

---

## ⏳ HUMAN-3 — Criar as duas carteiras de teste

Desbloqueia: correr o `ON-1` e o `ON-2` (criar a Safe e ligar o limite de gasto).

**Carteiras geradas em 2026-11-03** (endereços públicos; as chaves privadas estão só nos `.env` e no
gestor de senhas do dono, nunca no repositório):

| Papel                       | Endereço                                     |
| --------------------------- | -------------------------------------------- |
| Owner EOA (dona da Safe)    | `0xD02dfD4b3Ff250d5B414c31affA620E07F0Ea890` |
| Guard hot wallet (delegate) | `0xa95710875968439245265b977730ab69892dA470` |

Falta confirmar que os dois `.env` estão preenchidos (passos 3 a 5).

São duas carteiras novas, **só para testnet**. Não reutilizes nenhuma carteira que já tenha dinheiro real.

- **Owner EOA** — é a dona da Safe. É quem aprova mudanças e quem carrega no botão do kill switch.
- **Guard hot wallet** — é a carteira que o serviço Guard usa para pagar. Fica sempre com pouco dinheiro.

1. Dentro do Ubuntu, cria a primeira:
   ```bash
   cast wallet new
   ```
   Guarda o `Address` e o `Private key` num gestor de senhas. Esta é a **owner EOA**.
2. Corre outra vez para a segunda:
   ```bash
   cast wallet new
   ```
   Esta é a **guard hot wallet**.
3. Cria os dois `.env` a partir dos exemplos. **Cada worktree é um checkout separado**, por isso o
   `.env` tem de ficar no worktree onde a sessão dona desse pacote trabalha:

   ```bash
   cp ~/ag-onchain/packages/onchain/.env.example ~/ag-onchain/packages/onchain/.env
   ```

   ```bash
   cp ~/ag-guard-core/packages/guard-core/.env.example ~/ag-guard-core/packages/guard-core/.env
   ```

4. Preenche o do onchain (`nano` grava com `Ctrl+O`, `Enter`, e sai com `Ctrl+X`):

   ```bash
   nano ~/ag-onchain/packages/onchain/.env
   ```

   - `OWNER_PRIVATE_KEY=` chave privada da **owner EOA**
   - `HOT_WALLET_ADDRESS=` **endereço** da hot wallet (aqui só o endereço, nunca a chave)
   - `BASE_SEPOLIA_RPC_URL=https://sepolia.base.org`

5. Preenche o do guard-core:

   ```bash
   nano ~/ag-guard-core/packages/guard-core/.env
   ```

   - `HOT_WALLET_PRIVATE_KEY=` chave privada da **hot wallet**
   - `BASE_SEPOLIA_RPC_URL=https://sepolia.base.org`

   A chave da hot wallet existe num só sítio em todo o projeto: este ficheiro. É de propósito, e é o
   que faz o `guard-core` ser o único componente capaz de assinar.

6. Diz-me os **dois endereços** (endereços públicos podem ser ditos no chat; chaves privadas nunca).

> **Cuidado com o scrollback:** o `cast wallet new` imprime a chave privada no terminal, logo ela fica
> no histórico de scroll da janela. São carteiras de testnet, por isso o risco é baixo, mas fecha essa
> janela quando acabares em vez de a deixar aberta, e nunca partilhes uma captura de ecrã dela.

> Nota: o RPC público `https://sepolia.base.org` serve para começar. Para os testes de fork do Foundry
> um RPC dedicado (Alchemy ou QuickNode, plano grátis) é bem mais rápido. Se quiseres, trata disso
> quando o `ON-6` começar a ser lento e eu digo-te onde pôr o URL.

---

## ⏳ HUMAN-4 — Pôr fundos de teste nas duas carteiras

Precisas de **ETH de Base Sepolia** (para gás) nas duas carteiras, e de **USDC de teste** na owner EOA,
porque é a Safe dela que vai guardar o dinheiro.

A lista oficial e atualizada de faucets está em `docs.base.org/chain/network-faucets`. Se algum link
abaixo mudar, essa página é a fonte de verdade.

1. **ETH nas duas carteiras.** O faucet do Coinbase Developer Platform
   (`portal.cdp.coinbase.com`, secção Faucets) cobre Base Sepolia e dá até 0,1 ETH por 24 h, mas exige
   conta CDP. Sem conta, o faucet da Alchemy (`alchemy.com/faucets/base-sepolia`) dá 0,1 ETH por 24 h.
   Pede para os dois endereços:
   - owner: `0xD02dfD4b3Ff250d5B414c31affA620E07F0Ea890`
   - hot wallet: `0xa95710875968439245265b977730ab69892dA470`

2. **USDC só na owner.** O faucet da Circle (`faucet.circle.com`, rede **Base Sepolia**) é o canónico; o
   faucet do CDP também distribui USDC em Base Sepolia.

   Atenção: tem de ser o **USDC oficial da Circle**, não um token de teste qualquer. O Allowance Module
   vai ser configurado para um endereço de token exato, o que a tarefa `ON-8` verifica nas listas
   oficiais. Um token diferente com o mesmo nome não serve.

3. **Confirma o ETH:**

   ```bash
   cast balance 0xD02dfD4b3Ff250d5B414c31affA620E07F0Ea890 --rpc-url https://sepolia.base.org
   ```

   ```bash
   cast balance 0xa95710875968439245265b977730ab69892dA470 --rpc-url https://sepolia.base.org
   ```

   O valor vem em wei. `cast balance <addr> --ether --rpc-url ...` mostra em ETH.

4. **Confirma o USDC** em `sepolia.basescan.org`, procurando o endereço da owner e abrindo o separador
   de tokens. Por linha de comando precisaríamos do endereço do contrato USDC, que só fica fixado
   depois do `ON-8`.

5. Diz-me quando estiver feito.

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
