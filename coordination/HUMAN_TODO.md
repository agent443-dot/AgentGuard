# Tarefas do dono (só tu podes fazer)

Este ficheiro é escrito **só pelo manager** e é o único documento do repositório em português, porque é
dirigido a ti. As outras sessões não falam contigo diretamente: se precisarem de algo teu, deixam um
recado em `coordination/messages/manager/` e eu peço-te.

**Ambiente:** Windows com **WSL2 + Ubuntu**. Todos os comandos deste ficheiro correm **dentro do
Ubuntu**, nunca em PowerShell nem em Cmd. Abre as sessões do Claude Code também de dentro do Ubuntu.

**Regra de ouro: nunca coles chaves privadas no chat.** Geras a chave na tua máquina e colas tu mesmo no
ficheiro `.env` do pacote certo. O `.gitignore` já ignora todos os `.env`.

Estado: ✅ feito · ⏳ a aguardar-te · ⬜ ainda não é preciso

---

## ✅ HUMAN-1 — Criar o repositório e dar-me acesso

Feito. O repositório é `kikume/AgentGuard` e esta sessão já tem acesso de escrita. O branch `main` já
existe e é a base de onde as sessões abrem os `feat/<role>`.

---

## ⏳ HUMAN-2 — Preparar o ambiente: WSL2, Node, pnpm e Foundry

Desbloqueia: tudo o que corras localmente. Nada disto é urgente para as sessões 1 a 4 começarem a
escrever código, mas é preciso para tu correres testes e scripts na tua máquina.

Conta uns 20 a 30 minutos, a maior parte à espera de downloads.

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

## ⬜ HUMAN-3 — Criar as duas carteiras de teste

Depois do HUMAN-2. Desbloqueia: correr o `ON-1` e o `ON-2` (criar a Safe e ligar o limite de gasto).

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
