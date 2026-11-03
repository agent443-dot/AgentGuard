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

## Endereços onchain (Solana devnet)

Criados em 2026-11-03. Tudo público.

| O quê                       | Endereço                                       |
| --------------------------- | ---------------------------------------------- |
| Multisig Squads             | `3UUSmTssQT7xAnH7SKiStPyy1Tn2SUqUM53Ns7XnUcVu` |
| Cofre do multisig           | `EnvU6vPvQaKqFZ8cEGN1WhvAk6NZ7J4YJEfG84XgDhjJ` |
| Owner (membro, threshold 1) | `AxCgDMb1uirKHyEsC3WUkWY8G7CYa1BE1YX4j5bFpita` |
| Guard hot wallet            | `H5fcEu5KppqfZH83H34YXVwjwCamjfHDjGx1d8eykHjw` |

**O dinheiro vive no cofre, não na owner.** A owner é quem manda; o cofre é onde está o USDC que o
agente vai gastar sob o teto diário.

Um primeiro multisig (`F3Pc9pL53bArMXY9WSMk9TNkvfDdPvqx2PnL5aUppq8n`) foi criado por engano e está
abandonado e vazio. O script passou a recusar-se a criar um segundo.

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

## ✅ HUMAN-3 — Criar as duas carteiras de teste (Base)

Desbloqueia: as tarefas `EVM-*`, que só começam depois da suite de ataques em Solana estar verde. Nada
do que fizeste aqui se perde — estas carteiras são as da Base.

**Carteiras geradas em 2026-11-03** (endereços públicos; as chaves privadas estão só nos `.env` e no
gestor de senhas do dono, nunca no repositório). Um primeiro par foi gerado e descartado no mesmo dia
porque as chaves se perderam antes de serem guardadas — se encontrares endereços diferentes no
histórico do git, são esses, e não valem nada:

| Papel                       | Endereço                                     |
| --------------------------- | -------------------------------------------- |
| Owner EOA (dona da Safe)    | `0xaF553AaAcB5Ea0659B07cde7bdDd870C3FaF9A04` |
| Guard hot wallet (delegate) | `0x4FCEE11b4620Cb9122B83688B243bb996660F43b` |

Os dois `.env` estão preenchidos e verificados. Para confirmar o estado a qualquer momento sem
imprimir nenhum valor — mostra só o nome de cada variável e se está preenchida:

```bash
for f in ~/ag-onchain/packages/onchain/.env ~/ag-guard-core/packages/guard-core/.env; do echo "== $f"; grep -E '^[A-Z_]+=' "$f" | awk -F= '{printf "%-10s %s\n", ($2=="" ? "VAZIO" : "ok"), $1}'; done
```

Devem ficar `VAZIO` apenas o `SAFE_ADDRESS` dos dois ficheiros (o `ON-1` preenche-o) e os três
`TENDERLY_*` do guard-core (são opcionais).

**Verificar que cada chave corresponde ao endereço certo.** Um campo preenchido não quer dizer que
esteja correto: na primeira tentativa um endereço foi colado no lugar de uma chave, e a chave da owner
acabou dentro do `.env` do guard-core — o que anularia a garantia onchain inteira, já que a owner
controla a Safe toda e o guard-core é o serviço exposto. Estes dois comandos imprimem só o endereço
público derivado de cada chave, e a chave não fica no histórico da shell:

```bash
cast wallet address --private-key "$(grep '^OWNER_PRIVATE_KEY=' ~/ag-onchain/packages/onchain/.env | cut -d= -f2)"
```

```bash
cast wallet address --private-key "$(grep '^HOT_WALLET_PRIVATE_KEY=' ~/ag-guard-core/packages/guard-core/.env | cut -d= -f2)"
```

O primeiro tem de dar o endereço da owner, o segundo o da hot wallet. Se derem o mesmo endereço, a
mesma chave está nos dois ficheiros.

Nota de formato: um endereço tem 42 caracteres (`0x` + 40) e uma chave privada tem 66 (`0x` + 64). O
comprimento distingue-os de relance.

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

## ✅ HUMAN-3B — Criar o par de carteiras Solana

Desbloqueia: `SVM-1` e `SVM-2`, que são o caminho crítico agora que a Solana é a primeira chain.

**Keypairs gerados em 2026-11-03** (pubkeys; as chaves vivem só nos ficheiros JSON em
`~/.agentguard/`, com permissões 600, e nunca no repositório). Um primeiro par foi descartado no mesmo
dia porque a seed phrase foi impressa no terminal e colada no chat:

| Papel                                       | Pubkey                                         | Ficheiro                       |
| ------------------------------------------- | ---------------------------------------------- | ------------------------------ |
| Owner (dona do multisig Squads)             | `AxCgDMb1uirKHyEsC3WUkWY8G7CYa1BE1YX4j5bFpita` | `~/.agentguard/sol-owner.json` |
| Guard hot wallet (membro do spending limit) | `H5fcEu5KppqfZH83H34YXVwjwCamjfHDjGx1d8eykHjw` | `~/.agentguard/sol-hot.json`   |

Em Solana as chaves não vivem num `.env`: guardam-se em ficheiros JSON de keypair, que é a convenção do
ecossistema e o que as ferramentas esperam. O `.env` guarda o **caminho** para o ficheiro.

### 3B.1 Instalar o CLI da Solana

O cliente passou a ser mantido pela Anza. O binário continua a chamar-se `solana`.

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

```bash
exec zsh
```

```bash
solana --version
```

Se o `solana` não for encontrado depois do `exec zsh`, é o mesmo problema do Foundry — o instalador
escreveu o PATH num ficheiro de bash. Resolve-se igual:

```bash
grep -q '.local/share/solana' ~/.zshenv 2>/dev/null || echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.zshenv
```

### 3B.2 Gerar os dois keypairs

Guarda-os fora do repositório, numa pasta só tua:

```bash
mkdir -p ~/.agentguard && chmod 700 ~/.agentguard
```

```bash
solana-keygen new --no-bip39-passphrase --force --silent -o ~/.agentguard/sol-owner.json
```

```bash
solana-keygen new --no-bip39-passphrase --force --silent -o ~/.agentguard/sol-hot.json
```

```bash
chmod 600 ~/.agentguard/sol-*.json
```

O `--silent` é importante: sem ele o comando imprime a **seed phrase** no terminal, e essa frase de 12
palavras recupera o keypair inteiro — é tão secreta como o ficheiro. Imprimi-la no ecrã é convidá-la a
acabar numa captura de ecrã ou colada num chat. Com `--silent` a chave só existe no ficheiro JSON.

O ficheiro passa a ser a única cópia, por isso faz-lhe backup como farias a uma chave: copia
`~/.agentguard/*.json` para um sítio seguro. O `--force` permite sobrescrever um ficheiro existente,
que é o que precisas se alguma vez tiveres de substituir um par queimado.

### 3B.3 Preencher os `.env`

```bash
nano ~/ag-onchain/packages/onchain/.env
```

- `SOLANA_OWNER_KEYPAIR=/home/joaod/.agentguard/sol-owner.json`
- `SOLANA_HOT_WALLET_PUBKEY=` a **pubkey** do `sol-hot.json`

```bash
nano ~/ag-guard-core/packages/guard-core/.env
```

- `SOLANA_HOT_WALLET_KEYPAIR=/home/joaod/.agentguard/sol-hot.json`

Usa caminhos absolutos, não `~`: muitas bibliotecas não expandem o til.

### 3B.4 Confirmar

```bash
solana-keygen pubkey ~/.agentguard/sol-owner.json; solana-keygen pubkey ~/.agentguard/sol-hot.json
```

Diz-me as duas pubkeys — são públicas, podem vir pelo chat. **Só essas duas linhas**, não a saída
inteira dos comandos anteriores.

---

## ✅ HUMAN-4 — Pôr fundos de teste

Feito para a Solana em 2026-11-03: SOL nas duas keypairs, USDC no cofre do multisig. A parte da Base
espera pelas tarefas `EVM-*`.

### Solana devnet (agora)

Precisas de SOL nas duas keypairs e de USDC de devnet na owner.

As duas precisam de SOL, por razões diferentes: a owner paga as taxas de criar o multisig e o spending
limit, e a hot wallet paga as taxas de levantar do limite. Nos pagamentos x402 em si a hot wallet nem
precisa de SOL, porque no fluxo SVM o facilitator co-assina como fee payer — mas os levantamentos do
Squads são transações dela.

1. SOL pelo CLI, para cada pubkey (`<PUBKEY>` é o que o `solana-keygen pubkey` imprimiu):

   ```bash
   solana airdrop 2 <PUBKEY> --url devnet
   ```

   Se der rate limit, usa o faucet web da Solana Foundation em `faucet.solana.com`, que dá mais com
   login no GitHub.

2. USDC de devnet na **owner**, em `faucet.circle.com`, rede **Solana devnet**. O faucet do Coinbase
   Developer Platform também distribui USDC em Solana devnet.

   Tem de ser o USDC oficial da Circle. O spending limit vai ser configurado para um mint exato, que a
   tarefa `SVM-7` verifica nas fontes oficiais, e um token parecido não conta para o limite.

3. Confirma:

   ```bash
   solana balance <PUBKEY> --url devnet
   ```

   O USDC vês em `explorer.solana.com/?cluster=devnet`, procurando a pubkey da owner.

> Nota: depois do `SVM-1` criar o multisig, o USDC tem de passar da owner para o cofre do multisig — é
> lá que o dinheiro fica, não na owner. Isso é um passo do script, não teu.

### Base Sepolia (mais tarde)

Quando as tarefas `EVM-*` arrancarem, precisas de ETH de Base Sepolia nas duas carteiras EVM e de USDC
de teste na owner EVM:

- owner: `0xaF553AaAcB5Ea0659B07cde7bdDd870C3FaF9A04`
- hot wallet: `0x4FCEE11b4620Cb9122B83688B243bb996660F43b`

ETH sem conta no faucet da Alchemy (`alchemy.com/faucets/base-sepolia`), ou no do Coinbase Developer
Platform (`portal.cdp.coinbase.com`) com conta. USDC em `faucet.circle.com`, rede **Base Sepolia**. A
lista oficial de faucets da Base está em `docs.base.org/chain/network-faucets`.

```bash
cast balance 0xaF553AaAcB5Ea0659B07cde7bdDd870C3FaF9A04 --ether --rpc-url https://sepolia.base.org
```

```bash
cast balance 0x4FCEE11b4620Cb9122B83688B243bb996660F43b --ether --rpc-url https://sepolia.base.org
```

---

## ✅ HUMAN-9 — Confirmar os genesis hashes da Solana

Desbloqueia: `SVM-7`. Os identificadores de rede da Solana no código (`solana:5eykt4...`,
`solana:EtWTRA...`) estão marcados como não verificados. São os primeiros 32 caracteres do genesis
hash de cada rede, e só se confirmam perguntando à própria rede — coisa que as sessões na nuvem não
conseguem fazer. Se estiverem errados, todas as verificações de rede do x402 falham.

```bash
solana genesis-hash --url devnet
```

```bash
solana genesis-hash --url mainnet-beta
```

Cola as duas saídas no chat. São públicas.

Feito em 2026-11-03: os dois identificadores no código estão corretos. Registado em CR-002.

---

## ⏳ HUMAN-10 — Descarregar o programa Squads para os testes automáticos

Desbloqueia: `SVM-8`, os testes automáticos do teto onchain. Correm o programa Squads verdadeiro dentro
de um validador local, e para isso precisam do binário dele — que se descarrega da mainnet, coisa que as
sessões na nuvem não conseguem fazer. Os quatro testes estão escritos e à espera, marcados como
`skipped`.

O binário é público e vem do endereço oficial do programa, por isso os testes correm contra o código
que está mesmo em produção, e não contra uma imitação.

Vai para um branch próprio, `fixture/squads-v4`, e não para o `feat/onchain`: a Sessão 1 está a
empurrar para esse branch, e assim os dois nunca se pisam.

```bash
cd ~/AgentGuard && git fetch origin && git checkout -b fixture/squads-v4 origin/main
```

```bash
mkdir -p packages/onchain/test/fixtures && solana program dump -u m SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf packages/onchain/test/fixtures/squads_v4.so
```

```bash
git add packages/onchain/test/fixtures/squads_v4.so && git commit -m "test: add the Squads v4 program binary for the LiteSVM cap tests"
```

```bash
git push -u origin fixture/squads-v4 && git checkout main
```

Se o `git commit` responder `Please tell me who you are`, configura o git uma vez e repete o commit:
`git config --global user.name "O teu nome"` e `git config --global user.email "o-teu@email"`.

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
