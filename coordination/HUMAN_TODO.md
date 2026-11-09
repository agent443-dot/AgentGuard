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

**Antes de qualquer corrida ao vivo**, atualiza e reinicia, senão o sistema corre com código antigo
sem te avisar (foi assim que o botão da Phantom não apareceu da primeira vez):

```bash
cd ~/AgentGuard && git checkout main && git pull && pnpm install
```

Depois para o `pnpm dev:all` (`Ctrl+C`) e volta a arrancá-lo.

---

## Endereços onchain (Solana devnet)

Criados em 2026-11-03. Tudo público.

| O quê                       | Endereço                                       |
| --------------------------- | ---------------------------------------------- |
| Multisig Squads (Phantom)   | `4jJeVFvhnvbYFpHJNWWHCXpNzQArP6qSggkjLp5HACfX` |
| Cofre do multisig (Phantom) | `EaE8QqBH3GXP8R5iGkqPm3a44zadgwD1fyQwd4aNswXy` |
| Owner Phantom (config auth) | `BDg2wSX5TLz76gmPBXyg5wvpkEVhLSYVQg262WFwWG31` |
| Multisig antigo (reformado) | `3UUSmTssQT7xAnH7SKiStPyy1Tn2SUqUM53Ns7XnUcVu` |
| Cofre antigo (reformado)    | `EnvU6vPvQaKqFZ8cEGN1WhvAk6NZ7J4YJEfG84XgDhjJ` |
| Owner antiga (ficheiro)     | `AxCgDMb1uirKHyEsC3WUkWY8G7CYa1BE1YX4j5bFpita` |
| Guard hot wallet            | `H5fcEu5KppqfZH83H34YXVwjwCamjfHDjGx1d8eykHjw` |

**Solana mainnet — lançada em 2026-11-09 (HUMAN-22 bloco C)**

| O quê                     | Endereço                                       |
| ------------------------- | ---------------------------------------------- |
| Multisig Squads (Phantom) | `DrBCoaRm3XAfdwzdHrcqVepVLdRw5xudqwwe5y7TGvsL` |
| Cofre do multisig         | `GDXdjdE1gfKexfQevgebkpe13VKdmyAe9nm3QdFtCXna` |
| Hot wallet                | `DRtN…Voq1`                                    |
| Teto                      | 20 USDC por dia                                |

**Robinhood Chain mainnet (4663) — lançada em 2026-11-09 (piloto na HUMAN-21)**

| O quê                       | Endereço                                     |
| --------------------------- | -------------------------------------------- |
| Safe                        | `0xB460E05685c613EF726Fd74b91B24f4B4e989d8a` |
| Owner Phantom (só ela, 1/1) | `0x2cfBE309A0D2a3cc81D16fdD82F09e2f484f48Ba` |
| Hot wallet (delegate)       | `0x46F51787ccE5fD8582A5de0a79d9460148Bf2204` |
| Teto                        | 20 USDG por dia (5 no piloto)                |

**Robinhood Chain testnet (46630)**

| O quê                  | Endereço                                     |
| ---------------------- | -------------------------------------------- |
| Hot wallet (Robinhood) | `0x30E7E36153ee1Ee4eF7d865afE522f09b72f01Ec` |

**O dinheiro vive no cofre, não na owner.** A owner é quem manda; o cofre é onde está o USDC que o
agente vai gastar sob o teto diário.

Um primeiro multisig (`F3Pc9pL53bArMXY9WSMk9TNkvfDdPvqx2PnL5aUppq8n`) foi criado por engano e está
abandonado e vazio. O script passou a recusar-se a criar um segundo.

---

## ✅ HUMAN-1 — Criar o repositório e dar-me acesso

Feito. O repositório é agora `agent443-dot/AgentGuard` (antes `kikume/AgentGuard`; os links antigos
redirecionam) e esta sessão já tem acesso de escrita. O branch `main` já
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
cd ~ && git clone https://github.com/agent443-dot/AgentGuard.git && cd AgentGuard
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

ETH no faucet do Coinbase Developer Platform (`portal.cdp.coinbase.com`), com conta. O da Alchemy
recusa: só dá ETH de teste a quem já tem ETH na mainnet. USDC em `faucet.circle.com`, rede **Base Sepolia**. A
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

## ✅ HUMAN-10 — Descarregar o programa Squads para os testes automáticos

**Feito em 2026-11-04** (commit `8470861` no branch `fixture/squads-v4`). Com ele, os quatro testes
do teto passam contra o programa Squads verdadeiro.

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

## ✅ HUMAN-5 — Criar o bot do Telegram

Desbloqueia: `HUMAN-11`, a primeira corrida ao vivo. Isto é só do lado do Telegram — não mexes em
ficheiro nenhum aqui; a `HUMAN-11` diz-te onde pôr cada coisa.

1. No Telegram, fala com o [@BotFather](https://t.me/BotFather) e envia `/newbot`. Escolhe um nome e um
   username (tem de acabar em `bot`). Ele devolve um token no formato `123456789:AA...`.
   **Guarda-o no gestor de senhas e não o coles no chat** — com ele, qualquer pessoa controla o bot.
2. Descobre o teu número de utilizador: fala com o [@userinfobot](https://t.me/userinfobot).
3. **Abre o teu bot novo e envia-lhe `/start`.** É obrigatório: um bot do Telegram não pode escrever a
   quem nunca lhe escreveu primeiro, e sem isto os pedidos de aprovação nunca te chegam.
4. Diz-me "feito". Não preciso do token nem do número.

---

## ✅ HUMAN-11 — Primeira corrida ao vivo do sistema completo (devnet)

**Feito em 2026-11-04.** Três pagamentos reais em devnet, 3,5 USDC no total, todos pela hot wallet:

| Passo | O quê                                           | Transação                                                                                  |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 6     | transferência de 1,5 USDC, aprovada no Telegram | `28PfTDHGYd2ML18PRKQq2YuerLeZ9EGea5oyZCWVFw9H9SQu6iNavdWxjJpwio2nsrh6ou5PddCDC2N39dYewF9b` |
| 9     | x402 de 0,5 USDC, abaixo do limite, automático  | `5dEyeubtDt8p5r6bowo5MACYWiYeByh38yFgY8BAGYdz6GcM863hZdb5WHKgV2daCpvznwNj7HNUTWdDNrbbgvQZ` |
| 10    | x402 de 1,5 USDC, aprovado no Telegram          | `AYfUboJLhe8oBSeuMHxAHr5dmMZXqEMFE3pgAgUPFLjZX7aptDbnEWPZd9iZTzRsxDv73nzNQEeJqq2N3RxmV4K`  |

O passo 11 também está feito: `allowedDomains` do `agent-1` voltou a `[]`. O texto abaixo fica como
registo do que correste.

Desbloqueia: fecha a `INT-3` e é metade da porta `INT-5`, que liberta o trabalho da Base. Depois da
`HUMAN-5`. As duas partes já podem correr: o `pnpm dev:all` e o servidor x402 de teste estão no `main`.

Até aqui tudo correu na nuvem, contra chains simuladas. Isto liga o guard-core, o bot e o servidor MCP
ao teu multisig verdadeiro em devnet. Tudo corre em `~/AgentGuard`; os `.env` que tens nos worktrees
passam para lá, para o sistema inteiro viver num sítio só. Vais precisar de **três janelas** do Ubuntu.

### Parte A — uma transferência aprovada no Telegram

**1. Atualizar, trazer os `.env` que já existem e confirmar o do guard-core:**

```bash
cd ~/AgentGuard && git pull && cp ~/ag-guard-core/packages/guard-core/.env packages/guard-core/.env && cp ~/ag-onchain/packages/onchain/.env packages/onchain/.env && pnpm install
```

O `.env` do guard-core é de antes de algumas mudanças, por isso garante o endereço do multisig (o
comando pode repetir-se sem estragar nada) e confere o resto sem imprimir segredos:

```bash
cd ~/AgentGuard && f=packages/guard-core/.env && (grep -q '^SQUADS_MULTISIG=' "$f" && sed -i 's|^SQUADS_MULTISIG=.*|SQUADS_MULTISIG=3UUSmTssQT7xAnH7SKiStPyy1Tn2SUqUM53Ns7XnUcVu|' "$f" || echo 'SQUADS_MULTISIG=3UUSmTssQT7xAnH7SKiStPyy1Tn2SUqUM53Ns7XnUcVu' >> "$f") && for k in SOLANA_RPC_URL SOLANA_HOT_WALLET_KEYPAIR SQUADS_MULTISIG; do grep -q "^$k=." "$f" && echo "ok    $k" || echo "FALTA $k"; done; grep -q '^GUARD_STUB_CHAINS=true' "$f" && echo "PARA: GUARD_STUB_CHAINS=true" || echo "ok    GUARD_STUB_CHAINS"
```

Tem de dar quatro `ok`. Se disser `FALTA` ou `PARA`, não continues e cola-me a saída.

**2. O `.env` do bot.** Copia do guard-core os três segredos que têm de ser iguais nos dois lados,
**sem os mostrar no ecrã**:

```bash
cd ~/AgentGuard && cp packages/telegram-bot/.env.example packages/telegram-bot/.env && for p in GUARD_BOT_TOKEN:BOT_TOKEN GUARD_ADMIN_TOKEN:ADMIN_TOKEN BOT_WEBHOOK_SECRET:BOT_WEBHOOK_SECRET; do v=$(grep "^${p#*:}=" packages/guard-core/.env | cut -d= -f2-); sed -i "s|^${p%%:*}=.*|${p%%:*}=$v|" packages/telegram-bot/.env; done && echo "segredos copiados"
```

Depois, à mão, as duas coisas da `HUMAN-5`:

```bash
nano ~/AgentGuard/packages/telegram-bot/.env
```

- `TELEGRAM_BOT_TOKEN=` o token do BotFather
- `OWNER_TELEGRAM_IDS=` o teu número de utilizador

**3. Criar o agente e o `.env` do MCP.** O token do agente é gerado, guardado no ficheiro e nunca
aparece no ecrã:

```bash
cd ~/AgentGuard && cp packages/mcp-server/.env.example packages/mcp-server/.env && tok=$(pnpm --silent --filter @agentguard/guard-core create-agent agent-1 | tail -n1) && [[ "$tok" =~ ^[0-9a-f]{64}$ ]] && sed -i -e "s|^AGENT_ID=.*|AGENT_ID=agent-1|" -e "s|^AGENT_TOKEN=.*|AGENT_TOKEN=$tok|" -e "s|^MCP_TRANSPORT=.*|MCP_TRANSPORT=http|" -e "s|^# MCP_HTTP_TOKEN=.*|MCP_HTTP_TOKEN=$(openssl rand -hex 32)|" packages/mcp-server/.env && echo "agent-1 criado" || echo "FALHOU, cola-me a saida"
```

**4. Arrancar tudo — janela 1.** Fica a correr; não a feches:

```bash
cd ~/AgentGuard && pnpm dev:all
```

Antes de arrancar, ele cruza os três `.env` e recusa se algum segredo ou porta não bater, dizendo qual
variável. **Se imprimir `no Solana adapter`, para tudo e diz-me**: arrancaria na mesma, mas todos os
pagamentos seriam recusados.

**5. Dar uma política ao agente — janela 2.** Um agente novo recusa tudo. Esta é deliberadamente
apertada: até 2 USDC por pagamento, 10 por dia (abaixo dos 100 do teto onchain), só USDC em devnet,
transferências só para a tua owner, e **tudo a partir de 1 USDC passa por ti no Telegram**. O
`127.0.0.1` é para o servidor de teste da parte B, e sai no fim:

```bash
cd ~/AgentGuard && t=$(grep '^ADMIN_TOKEN=' packages/guard-core/.env | cut -d= -f2-) && curl -sS -X PUT http://localhost:8787/v1/admin/policy/agent-1 -H "Authorization: Bearer $t" -H 'content-type: application/json' -d '{"chains":["solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"],"tokens":["4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"],"perTxMax":"2000000","dailyMax":"10000000","approvalThreshold":"1000000","allowedRecipients":["AxCgDMb1uirKHyEsC3WUkWY8G7CYa1BE1YX4j5bFpita"],"allowedDomains":["127.0.0.1"],"paused":false}'
```

**6. A primeira transferência a sério.** O agente pede 1,5 USDC para a tua owner. Está acima do
limiar, por isso tem de te chegar ao Telegram:

```bash
cd ~/AgentGuard && t=$(grep '^AGENT_TOKEN=' packages/mcp-server/.env | cut -d= -f2-) && curl -sS -X POST http://localhost:8787/v1/agent/transfer -H "Authorization: Bearer $t" -H 'content-type: application/json' -d '{"agentId":"agent-1","chain":"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1","token":"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU","amount":"1500000","recipient":"AxCgDMb1uirKHyEsC3WUkWY8G7CYa1BE1YX4j5bFpita","reason":"first live test"}'
```

Deve responder `"status":"pending_approval"` e, segundos depois, aparece-te a mensagem no Telegram com
os botões. Carrega em **Approve**. Cola-me a resposta do `curl` e diz-me o que viste no Telegram — a
resposta não tem segredos.

### Parte B — pagamentos x402 a sério (depois da parte A funcionar)

Não existe nenhum servidor x402 público em devnet em que possamos confiar, por isso o projeto traz um:
um servidor pago que faz de facilitador e liquida o pagamento na devnet. Usa a tua owner para pagar as
taxas da rede e para receber o USDC — não precisas de carteira nova.

**7. Configurar o servidor de teste.** Nada disto é secreto — é um caminho e um endereço público:

```bash
cd ~/AgentGuard && git pull && pnpm install && cp e2e/.env.example e2e/.env && sed -i -e 's|^PAYWALL_FEE_PAYER_KEYPAIR=.*|PAYWALL_FEE_PAYER_KEYPAIR=/home/joaod/.agentguard/sol-owner.json|' -e 's|^PAYWALL_PAY_TO=.*|PAYWALL_PAY_TO=AxCgDMb1uirKHyEsC3WUkWY8G7CYa1BE1YX4j5bFpita|' e2e/.env && echo "e2e configurado"
```

**8. Arrancar o servidor de teste — janela 3:**

```bash
cd ~/AgentGuard && pnpm --filter @agentguard/e2e paywall
```

**9. Um pagamento x402 abaixo do limiar — janela 2.** Custa 0,5 USDC, por isso passa sem te perguntar:

```bash
cd ~/AgentGuard && t=$(grep '^AGENT_TOKEN=' packages/mcp-server/.env | cut -d= -f2-) && curl -sS -X POST http://localhost:8787/v1/agent/x402/fetch -H "Authorization: Bearer $t" -H 'content-type: application/json' -d '{"agentId":"agent-1","url":"http://127.0.0.1:8790/data","method":"GET"}'
```

Deve responder `"status":"executed"`, e a janela 3 imprime `settled on devnet: <assinatura>`.

**10. Um pagamento x402 que precisa de ti.** Na janela 3, `Ctrl+C`, e volta a arrancar o servidor a
pedir 1,5 USDC:

```bash
cd ~/AgentGuard && PAYWALL_AMOUNT=1500000 pnpm --filter @agentguard/e2e paywall
```

Na janela 2 repete o comando do passo 9. Deve dar `"status":"pending_approval"`. Aprova no Telegram e
**repete o mesmo comando outra vez**: a aprovação vale uma só vez, e devolve `"status":"executed"`.

**11. Tirar a autorização de teste.** O `127.0.0.1` deixava o agente mandar o guard-core fazer pedidos a
serviços da tua própria máquina, por isso não pode ficar:

```bash
cd ~/AgentGuard && t=$(grep '^ADMIN_TOKEN=' packages/guard-core/.env | cut -d= -f2-) && curl -sS -X PUT http://localhost:8787/v1/admin/policy/agent-1 -H "Authorization: Bearer $t" -H 'content-type: application/json' -d '{"chains":["solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"],"tokens":["4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"],"perTxMax":"2000000","dailyMax":"10000000","approvalThreshold":"1000000","allowedRecipients":["AxCgDMb1uirKHyEsC3WUkWY8G7CYa1BE1YX4j5bFpita"],"allowedDomains":[],"paused":false}'
```

Cola-me as respostas dos passos 9 e 10 e o que a janela 3 imprimiu. Se a liquidação falhar, a saída da
janela 3 não tem segredos — é a primeira vez que isto corre contra a devnet a sério.

---

## ⬜ HUMAN-6 — (opcional) Conta Tenderly

Melhora a simulação de transações. Sem isto, o `guard-core` simula com `eth_call`, que já funciona.

Se quiseres: cria conta em `tenderly.co`, cria um projeto, gera uma access key e preenche
`TENDERLY_ACCOUNT_SLUG`, `TENDERLY_PROJECT_SLUG` e `TENDERLY_ACCESS_KEY` em `packages/guard-core/.env`.

---

## ✅ HUMAN-12 — A Safe na Base Sepolia

**Feito em 2026-11-05**, guiado pelo integrator. Tudo público:

| O quê                        | Valor                                                                |
| ---------------------------- | -------------------------------------------------------------------- |
| Safe                         | `0x1df91C7e227370F138Ae546f3D2fa2Fde8a48C2D`                         |
| Owner (threshold 1)          | `0xaF553AaAcB5Ea0659B07cde7bdDd870C3FaF9A04`                         |
| Delegate (hot wallet)        | `0x4FCEE11b4620Cb9122B83688B243bb996660F43b`                         |
| Teto                         | 100 USDC, renova a cada 1440 min                                     |
| Transação `create-safe`      | `0x7c81fa17ca5ad46b975f36ad293b35e4bd8645e3faf8c6eb29933fbce259e1e0` |
| Transação `enable-allowance` | `0xcbe604b253efbd0f864f217e6168d54e0cc84a74033ea8315d311871a9937157` |

O `SAFE_ADDRESS` está nos dois `.env`. O texto abaixo fica como registo. O que vem a seguir é a
`HUMAN-13`.

Desbloqueia: `EVM-1` e `EVM-2` ao vivo, e depois a corrida da Base (`INT-6`). É o equivalente da Base ao
que fizeste em Solana com o multisig e o spending limit: uma Safe tua, com a hot wallet como delegate
do Allowance Module e um teto diário de 100 USDC.

As sessões na nuvem não chegam à rede da Base nem ao site da Circle, por isso as verificações são
tuas. Tudo corre em `~/AgentGuard`.

### Parte A — verificar e pôr fundos (já podes fazer)

1. ✅ **O Allowance Module existe na Base Sepolia** — já não precisas de verificar. Os testes do GitHub
   confirmaram, em 2026-11-04, que está em `0xAA46724893dedD72658219405185Fb0Fc91e091C` com exatamente o
   mesmo código que a Safe publica para a Base mainnet (hash `0x7aa63aff…cf3e`, registado na `CR-005`).

2. ✅ **O USDC da Base Sepolia** — confirmado por ti contra a Circle em 2026-11-04 e já no código (`shared/addresses.ts`). O SDK x402 que usamos dá `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
   Abre [a página da Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses), procura
   a linha **Base Sepolia** e confirma que é exatamente esse endereço. Depois confirma na chain:

   ```bash
   cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e "symbol()(string)" --rpc-url https://sepolia.base.org
   ```

   Tem de responder `"USDC"`.

3. **Fundos.** ETH de Base Sepolia nas duas carteiras (a owner paga a criação da Safe; a hot wallet vai
   pagar os levantamentos) e USDC de teste na owner. Os faucets estão na `HUMAN-4`, secção Base Sepolia.
   Confirma o ETH:

   ```bash
   cast balance 0xaF553AaAcB5Ea0659B07cde7bdDd870C3FaF9A04 --ether --rpc-url https://sepolia.base.org
   ```

   ```bash
   cast balance 0x4FCEE11b4620Cb9122B83688B243bb996660F43b --ether --rpc-url https://sepolia.base.org
   ```

4. Diz-me se a Circle bate com o passo 2, e os dois saldos.

### Parte B — criar a Safe (o código já está no `main`)

Logo a seguir à Parte A.

5. Atualiza o código e acrescenta ao `.env` do onchain as variáveis da Base. O comando substitui cada
   linha se já existir e acrescenta-a se não existir, por isso podes repeti-lo:

   ```bash
   cd ~/AgentGuard && git checkout main && git pull && pnpm install && cd packages/onchain && for kv in BASE_CHAIN_ID=84532 BASE_RPC_URL=https://sepolia.base.org; do k=${kv%%=*}; if grep -q "^$k=" .env; then sed -i "s|^$k=.*|$kv|" .env; else echo "$kv" >> .env; fi; done
   ```

6. ✅ O RPC da Base aceita as simulações que o guard-core faz antes de cada pagamento — os testes do
   GitHub confirmaram-no contra `sepolia.base.org`. Não precisas de fazer nada aqui.

7. Confirma que a chave da owner no `.env` é a da owner EVM. Imprime só o endereço derivado:

   ```bash
   cast wallet address --private-key "$(grep '^OWNER_PRIVATE_KEY=' ~/AgentGuard/packages/onchain/.env | cut -d= -f2)"
   ```

   Tem de dar `0xaF553AaAcB5Ea0659B07cde7bdDd870C3FaF9A04`.

8. Cria a Safe:

   ```bash
   cd ~/AgentGuard/packages/onchain && pnpm create-safe
   ```

   A última linha é `SAFE_ADDRESS=0x...`. Põe esse valor no `SAFE_ADDRESS=` dos **dois** `.env`,
   `packages/onchain/.env` e `packages/guard-core/.env`.

9. Liga o Allowance Module com o teto diário:

   ```bash
   cd ~/AgentGuard/packages/onchain && pnpm enable-allowance
   ```

   Tem de acabar com `module enabled: true` e `allowance: 100000000, spent 0, resets every 1440 min`.

10. Cola-me as saídas dos passos 8 e 9. É tudo público.

---

## ✅ HUMAN-13 — Primeira corrida ao vivo na Base Sepolia

**Feito em 2026-11-05.** A Base passou de ponta a ponta, e a Solana voltou a passar a partir do pior
caso. Tudo com a hot wallet a começar vazia, depois da correção do PR #63:

| Chain  | O quê                                                  | Transação                                                                                  |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Base   | x402 de 1,5 USDC, aprovado no Telegram                 | `0x54fdc347386a518a7045ce9e21fcd538b40ee814db20ad18f4d92a7bea35cc21`                       |
| Base   | x402 de 0,5 USDC, hot wallet vazia, levantado da Safe  | `0x1f40b2d003eac15bcfc06fb045ffe32ca19b1e259f8bf10c251abc0528974493`                       |
| Solana | x402 de 0,5 USDC, hot wallet vazia e sem conta de USDC | `23kwrForwWeYT9U3CALogx83pUCP6fsYZPEQxYpbBZkm1gzqkGh1bGwfHNqnjnTpaYEGj1Yd9ff6w8dWfJx3ccDh` |

Depois de cada pagamento, o teto onchain mostrou exatamente 0,5 USDC gasto, e o dinheiro saiu da Safe
e do cofre — não de outro lado. O texto abaixo fica como registo.

**Parada em 2026-11-05 por um bug que a tua corrida encontrou.** O primeiro pagamento (0,5 USDC) foi
recusado antes de assinar nada: o guard-core simula o pagamento antes de tirar o dinheiro da Safe para
a hot wallet, e com a hot wallet vazia a simulação falha. A Sessão 1 está a corrigir a simulação da
Base para incluir esse levantamento. Retomas quando eu te disser que a correção entrou no `main`, e a
corrida conta só com a hot wallet a começar vazia.

A causa ficou confirmada no mesmo dia: com 20 USDC postos à mão na hot wallet, o mesmo pagamento passou
(`0x4ff9be8c8a2778ffdb94b19288fe28af60c8a06dd043a9f6fef247499c17de34`). A correção (PR #63) mostrou que
a Solana tinha a mesma falha, e mais uma: o levantamento falhava se a hot wallet nunca tivesse tido
USDC. Por isso a corrida desta tarefa inclui também **um pagamento na Solana com a hot wallet vazia**.

Desbloqueia: fecha a `INT-6`, a corrida da Base equivalente à `HUMAN-11`. O integrator está a guiar-te
passo a passo na sessão dele; aqui fica só o resumo para saberes onde estás:

1. USDC de teste da Circle (`faucet.circle.com`, rede **Base Sepolia**) enviado **diretamente para a
   Safe** `0x1df91C7e227370F138Ae546f3D2fa2Fde8a48C2D` — é lá que o dinheiro vive, como no cofre da
   Solana.
2. `pnpm status:base` para confirmar a Safe, o módulo, o teto e o saldo, lidos da chain.
3. A corrida x402 através do guard-core: `pnpm --filter e2e paywall:base`, um pagamento abaixo do
   limite (automático) e outro acima (aprovado por ti no Telegram).

---

## ✅ HUMAN-14 — Alojar a página de assinatura da Phantom

**Feito em 2026-11-06.** A página está em `https://agentguard-onchain.vercel.app`, no projeto Vercel
`agentguard-onchain`, construída a partir de `packages/onchain/web`. Aberta sem parâmetros responde
"This link is not valid", que é o comportamento certo. No `.env` do bot,
`SIGN_PAGE_URL=https://agentguard-onchain.vercel.app`. O texto abaixo fica como registo.

Desbloqueia: o kill a um toque a partir do Telegram, e a seguir a corrida em devnet com a Phantom
(D4, ADR 003). A página está no `main` em `packages/onchain/web`. Não tem servidor nem segredos: só
constrói a transação, mostra-te o que vais assinar e passa-a à Phantom.

Fica num **projeto Vercel só dela**, separado da landing page, para que nenhuma mudança no site de
marketing possa tocar no que tu assinas.

1. Em [vercel.com/new](https://vercel.com/new), importa o repositório `kikume/AgentGuard` outra vez,
   como um **projeto novo** (não mexas no projeto da landing page).
2. Nome do projeto: `agentguard-sign`. Em **Root Directory** escolhe `packages/onchain/web`. Deixa o
   resto como está — o `vercel.json` da pasta já define a instalação, o build e os cabeçalhos de
   segurança. Antes de carregar em **Deploy**, abre **Environment Variables** e acrescenta uma:

   | Nome                       | Valor                                          |
   | -------------------------- | ---------------------------------------------- |
   | `SOLANA_HOT_WALLET_DEVNET` | `H5fcEu5KppqfZH83H34YXVwjwCamjfHDjGx1d8eykHjw` |

   É o endereço público da tua hot wallet de devnet. A página fica com ele gravado, e por isso nenhum
   link falso te consegue fazer assinar um teto para a chave de outra pessoa. O teto máximo que a
   página aceita é 50 USDC, como decidiste na D1. Para mainnet acrescenta-se depois
   `SOLANA_HOT_WALLET_MAINNET`, com a hot wallet nova. Depois carrega em **Deploy**.

3. Depois do primeiro deploy, confirma duas coisas:
   - em **Settings → Git**, o **Production Branch** é `main` (a regra de só publicar o `main` já vem
     no `vercel.json`);
   - em **Settings → Deployment Protection**, liga a proteção para **Preview Deployments**, para que
     nenhuma versão fora do `main` fique acessível a quem não seja tu;
   - em **Settings → Build and Deployment**, **Include files outside the Root Directory** está ligado
     (vem ligado por defeito).

   No log do deploy tem de aparecer o `pnpm install --frozen-lockfile` e depois o `pnpm build:web`.
   Se o deploy falhar na instalação, cola-me as últimas linhas do log.

4. Diz-me o endereço que o Vercel te deu (algo como `agentguard-sign.vercel.app`). É público.

Um domínio próprio fica para mainnet; para devnet o endereço do Vercel chega e já é uma origem só
desta página.

---

## ✅ HUMAN-15 — Ensaio em devnet com a Phantom como owner

**Feito em 2026-11-07.** Tudo o que é da owner foi assinado na Phantom:

| Passo                                    | Resultado                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Criar o multisig                         | ✅ `4jJe…ACfX`, controlado só pela Phantom `BDg2…WG31`                                        |
| Teto de 50 USDC por dia                  | ✅ só a hot wallet `H5fc…jw` levanta, e só para ela                                           |
| Pagamento x402 de 0,5 USDC, hot vazia    | ✅ `3DPWzUit3XaqcmXYzfQhmZcNREcQhPVPWw3aEZRdGcsrVLKruRupkeA79fwF1hSe8T7LfniM2rF422gfouciJUEs` |
| Kill pelo botão do Telegram, no iPhone   | ✅ abriu dentro da Phantom; `status` deu `spending limit: none`                               |
| Repor (`/resume agent-1` + teto de novo) | ✅                                                                                            |

O que a Phantom mostrou antes de assinar: o nosso domínio, só SOL a mexer (renda e taxa), nenhum
aviso. Verificações da ADR 003: #3, #4 e #5 (iOS) passaram; Android por testar; #1 e #2 eram opcionais.

Falta só uma confirmação tua: `pnpm --filter @agentguard/onchain status` tem de mostrar o teto de volta
com `50000000`.

Depois da `HUMAN-14`. É o ensaio geral da mainnet com a decisão D4. **O multisig com a Phantom como
owner passa a ser o setup de devnet daqui em diante**; o antigo (`3UUS…cVu`) fica reformado, com os
25,5 USDC de devnet lá dentro, sem risco. A hot wallet continua a ser a `H5fc…jw`.

O integrator guia-te ao vivo, com o endereço real da página; aqui fica o resumo da ordem:

1. **Phantom nova**, com uma frase de recuperação nova, em modo de teste (Settings → Developer
   Settings → Testnet Mode → Solana Devnet). Uns 0,1 SOL de devnet de `faucet.solana.com`.
2. **Criar o multisig** na página de assinatura, aberta no navegador dentro da Phantom. Anotar o
   multisig, o cofre e a transação.
3. **Pôr USDC no cofre novo** com `pnpm fund-vault`, a partir de uma carteira que já tenha USDC.
   **Não uses o faucet da Circle para o cofre**: o cofre é um endereço especial (fora da curva) e o
   USDC do faucet nunca lá chega.
4. **Pôr o teto de 50 USDC** na mesma página. Anotar a transação.
5. **Trocar o sistema para o multisig novo**: `SQUADS_MULTISIG` nos três `.env` (guard-core, onchain,
   bot), e no do bot também `SIGN_PAGE_URL` e `SOLANA_HOT_WALLET_PUBKEY`. Reiniciar o `pnpm dev:all`.
6. **Confirmar**: `pnpm status` mostra a Phantom como config authority, o teto de 50 USDC e a hot
   wallet como único membro e destino. Depois um pagamento x402 de 0,5 USDC com a hot wallet vazia.
7. **O kill**: `/kill` no Telegram → **Kill everything** → **Open kill in Phantom** → confirmar na
   Phantom. Anotar o que a Phantom mostrou (o nosso domínio, a simulação sem saída de USDC) e se o
   botão abriu dentro da Phantom no telemóvel. `pnpm status` tem de dizer `spending limit: none`.
8. **Repor**: `/resume agent-1` no Telegram e repetir o passo 4. `pnpm status` mostra o teto de volta.

---

## ✅ HUMAN-16 — Passar a chave da hot wallet da Base para um ficheiro

**Feito em 2026-11-07.** A chave está em `~/.agentguard/base-hot.key` (`0600`), o `.env` só aponta
para ela, e o guard-core arrancou com a Base ligada. O texto abaixo fica como registo.

Desde o PR #81 o guard-core **recusa arrancar** se o `.env` tiver `HOT_WALLET_PRIVATE_KEY`: uma
chave escrita num `.env` acaba copiada para onde não devia. Ela passa a viver num ficheiro só teu, com
permissões fechadas, e o `.env` só aponta para ele. O integrator guia-te; o resumo:

1. Mover a chave da Base do `packages/guard-core/.env` para `~/.agentguard/base-hot.key`, com
   `chmod 600`, sem a imprimir no terminal.
2. Apagar a linha `HOT_WALLET_PRIVATE_KEY=` desse `.env` e pôr no lugar
   `BASE_HOT_WALLET_KEY_FILE=/home/joaod/.agentguard/base-hot.key`.
3. Reiniciar o `pnpm dev:all` e confirmar que o guard-core arranca.

---

## ✅ HUMAN-17 — Pôr o guard-core e o bot no Fly.io (devnet)

**Feito em 2026-11-08.** O guard-core está em `https://agentguard-guard-core.fly.dev` e o bot no Fly,
os dois em São Paulo. Um pagamento x402 de 0,5 USDC passou pelo guard-core alojado (o teto mostrou
$0,50 de $50), e o `/kill` → **Confirm** parou o agente e removeu o teto na chain. A revisão de
segurança do sistema alojado (`INT-7`) passou. Estado atual: agente `fly-agent` em pausa, teto de
devnet removido.

**Regra que esta corrida ensinou:** um kill começa **sempre** por `/kill` → **Confirm** no Telegram.
O botão **Open kill in Phantom** de uma mensagem antiga só remove o teto na chain — não pára o
agente no guard-core. O texto abaixo fica como registo.

Depois da `HUMAN-16`. Decisões D3 e D5. É o primeiro deploy, ainda em devnet com o multisig da Phantom:
o mesmo sistema que corres em casa, agora num servidor. O integrator guia-te ao vivo e corre a seguir
a revisão de segurança do sistema alojado (`INT-7`). Os comandos completos estão nos READMEs, na
secção **Deploy on Fly.io** de `packages/guard-core` e de `packages/telegram-bot`. Nenhum segredo é
escrito no terminal: cada um vai por um ficheiro, com `fly secrets import`.

A ordem:

1. **Conta no Fly.io** em `fly.io` (pede um cartão, mesmo no plano grátis). Depois, no Ubuntu:

   ```bash
   curl -L https://fly.io/install.sh | sh && fly auth login
   ```

2. **Parar o sistema local**: `Ctrl+C` no `pnpm dev:all`. Dois bots com o mesmo token fazem o
   Telegram recusar os dois.
3. **Criar as duas apps e o volume da base de dados**, na tua organização pessoal do Fly:

   ```bash
   fly apps create agentguard-guard-core --org personal && fly apps create agentguard-bot --org personal
   ```

   ```bash
   fly volumes create guard_data --app agentguard-guard-core --region gru --size 1
   ```

4. **guard-core**: passos 2 a 5 do README dele — os segredos, a chave da hot wallet, o deploy e a
   verificação. No fim, `/health` responde e uma rota de admin dá `404` do lado público.
5. **Bot**: passos 3 a 5 do README dele.
6. **Primeiro agente no servidor**: a base de dados no Fly começa vazia, por isso o agente cria-se
   lá, por `fly ssh console`, e o token vai direto para o `.env` do servidor MCP sem aparecer no ecrã.
   A política aplica-se pela porta privada, aberta só no teu computador com `fly proxy 8787` enquanto
   for precisa.
7. **O servidor de pagamentos de teste fica acessível ao guard-core alojado**: corre no teu computador
   como antes, e um túnel temporário da Cloudflare (`cloudflared`, sem conta) dá-lhe um endereço
   `https://….trycloudflare.com`. Esse endereço exato vai para `allowedDomains`. Fecha-se no fim.
8. **Um pagamento x402 de 0,5 USDC** através do guard-core alojado, e um `/kill` pelo Telegram e pela
   Phantom, como na `HUMAN-15`.

---

## ✅ HUMAN-18 — Confirmar os endereços da Robinhood Chain

**Feito em 2026-11-07.** Os dois endereços do USDG batem com as páginas da Paxos. No explorador há
dezenas de tokens chamados "USDC" (alguns com dezenas de milhares de detentores) — por isso a regra é
aceitar **só** o endereço exato do USDG, e o bot avisa sobre qualquer outro token com nome USDC ou
USDG. O texto abaixo fica como registo.

Desbloqueia: o adaptador da Robinhood Chain (D6: Solana → Robinhood Chain → Base). A pesquisa da Sessão
1 (`packages/onchain/docs/robinhood-research.md`) mostrou que nada bloqueia: a Safe e o Allowance
Module oficiais existem lá, e o dólar da rede, o **USDG da Paxos**, aceita a assinatura que o x402 usa.
As sessões na nuvem não conseguem abrir estes sites, por isso a confirmação é tua — como fizeste com a
Circle. Não tens de escrever nada nem de assinar nada; só ler e comparar.

1. **USDG de testnet** — abre
   [docs.paxos.com/guides/stablecoin/usdg/testnet](https://docs.paxos.com/guides/stablecoin/usdg/testnet),
   procura a linha **Robinhood Chain** e confirma que o endereço é exatamente
   `0x7E955252E15c84f5768B83c41a71F9eba181802F`.
2. **USDG de mainnet** — abre
   [docs.paxos.com/guides/stablecoin/usdg/mainnet](https://docs.paxos.com/guides/stablecoin/usdg/mainnet)
   e confirma `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`.
3. **Cópias falsas de "USDC"** — abre
   [robinhoodchain.blockscout.com/tokens?q=USDC](https://robinhoodchain.blockscout.com/tokens?q=USDC)
   e diz-me os endereços que aparecem. Vão para uma lista de bloqueio, para o bot te avisar pelo nome
   se um pagamento tentar usá-los.
4. Diz-me "1 bate, 2 bate" (ou o que não bate) e a lista do passo 3.

Depois disso trago-te a `CR-007` para aprovares: o código passa a falar de "o dólar da rede" (USDC na
Solana e na Base, USDG na Robinhood Chain) em vez de só USDC.

---

## ✅ HUMAN-19 — Atualizar o bot no Fly (botões de kill com prazo)

**Feito em 2026-11-08.** O bot novo está no Fly e o `/status` responde; a página que exige a hora
nos links (PR #100) entrou a seguir. O texto abaixo fica como registo. O bot passa a mostrar o botão da Phantom só depois
de o guard-core confirmar a pausa, e cada link de kill passa a levar a hora em que foi criado, para a
página recusar links velhos. **A ordem importa**: primeiro o bot, depois a página (PR #100) — ao
contrário, os botões de kill deixavam de funcionar entretanto. O integrator guia-te; são uns 3 minutos:

```bash
cd ~/AgentGuard && git checkout main && git pull && pnpm install
```

```bash
cd ~/AgentGuard && if grep -qx '\*\*/.env' .dockerignore; then fly deploy . --config packages/telegram-bot/fly.toml --dockerfile packages/telegram-bot/Dockerfile --ha=false; else echo 'STOP: the root .dockerignore must exclude **/.env'; fi
```

Depois, no Telegram, `/status` tem de responder normalmente.

---

## ✖️ HUMAN-20 — Primeira corrida na testnet da Robinhood Chain (substituída pela HUMAN-21)

**Parada em 2026-11-08.** A verificação n.º 1 passou (a Phantom está na Robinhood Chain testnet) e a
hot wallet de testnet foi criada, mas os faucets não chegaram: o oficial só deu ETH à Phantom, a
Phantom não deixou reenviá-lo para a hot wallet, e não há faucet de USDG confirmado na 46630.
Decidiste passar diretamente a um piloto pequeno com dinheiro real — a `HUMAN-21`.

**Já podes fazer tudo**: as três páginas da Robinhood Chain (criar a Safe, ligar o teto, kill) estão
no `main` desde 2026-11-08, cada uma verificada contra a testnet. Faz o passo 2 primeiro, porque o
Vercel tem de republicar a página com a tua hot wallet antes do passo 4. A página de criar a Safe
abre-se na Phantom em
`https://agentguard-onchain.vercel.app/?action=create&cluster=robinhood-testnet` — é aí que se vê a
verificação n.º 1 (a Phantom tem de mudar para a rede 46630).

Depois de as páginas de assinatura da Phantom para a Robinhood Chain (criar a Safe, ligar o teto, kill)
estarem no `main` — eu aviso-te. É o equivalente da `HUMAN-15` + `HUMAN-17` para a Robinhood Chain,
com o **USDG** como dólar. O integrator guia-te ao vivo; aqui fica a ordem:

1. **A Phantom aceita a Robinhood Chain?** Na tua Phantom de teste, em modo de testnet, confirma que a
   Robinhood Chain testnet aparece. É a verificação n.º 1: se não aparecer, paramos e repensamos a D4
   para esta rede.
2. **Uma hot wallet nova só para a Robinhood Chain**, separada da da Base. Este comando cria a chave
   direto em `~/.agentguard/rh-hot.key` (`0600`), recusa escrever por cima de uma que já exista, e
   imprime **só o endereço**:

   ```bash
   cd ~/AgentGuard/packages/onchain && (umask 077 && mkdir -p ~/.agentguard && node --input-type=module -e "import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'; import { writeFileSync } from 'node:fs'; const key = generatePrivateKey(); writeFileSync(process.env.HOME + '/.agentguard/rh-hot.key', key + '\n', { mode: 0o600, flag: 'wx' }); console.log(privateKeyToAddress(key))")
   ```

   Esse endereço público vai para o Vercel, no projeto `agentguard-onchain`, como variável
   `ROBINHOOD_HOT_WALLET_TESTNET` — a página só aceita essa hot wallet.

3. **ETH e USDG de testnet.** ETH em `faucet.testnet.chain.robinhood.com`, para a tua conta Phantom e
   para a hot wallet (a Safe não precisa). USDG no faucet da Paxos (`faucet.paxos.com`), **para a tua
   conta Phantom** — confirma se a Robinhood Chain testnet aparece lá. Fica lá até a Safe existir (passo 4).
4. **Criar a Safe** na página de assinatura, na Phantom. Logo a seguir, envia o USDG da Phantom para a Safe com uma
   transferência normal — primeiro um valor pequeno — e confirma com
   `pnpm --filter @agentguard/onchain status:robinhood`.
5. **Ligar o Allowance Module com o teto de 50 USDG**, na mesma página.
6. **Pôr os segredos da Robinhood no Fly**: no guard-core, a chave da hot wallet e o `ROBINHOOD_*`;
   no bot, o `ROBINHOOD_CHAIN` e o `ROBINHOOD_SAFE_ADDRESS` (públicos), para o `kill` ter também o
   botão da Robinhood Chain. Redeploy dos dois.
7. **Um pagamento x402 em USDG** contra um servidor de pagamentos de teste da Robinhood (o integrator
   prepara-o), com a hot wallet a começar vazia.
8. **O kill**: `/kill` → **Confirm** no Telegram, e depois o botão da Phantom para remover o teto.

---

## ✅ HUMAN-21 — Piloto com dinheiro real na Robinhood Chain (mainnet 4663)

**Feito em 2026-11-09 — o primeiro pagamento com dinheiro real.** Um pagamento x402 de 0,50 USDG
passou de ponta a ponta (`0xa9c7abffb5676651193e866e4f02d9925a72c100ba20972226075dad78083d86`): a
hot wallet `0x46F5…2204` pagou, a tua conta `0x2cfB…F48Ba` recebeu. Depois, `/kill` parou o
guard-core, o kill na Phantom removeu o delegate, e o `/status` mostra "Robinhood Chain: no onchain
limit (killed)". A Safe `0xB460…9d8a` continua só tua, com 4,41 USDG.

O bot no Fly ainda era a versão antiga, sem o botão da Robinhood — usou-se o link manual. A regra de
atualizar antes de qualquer corrida ao vivo vale também para o Fly. O texto abaixo fica como registo.

**Decisão tua de 2026-11-08, com o risco aceite** e registado no `LAUNCH.md`: as páginas de assinatura
da Robinhood Chain e o pagamento x402 em USDG só foram provados contra cópias da rede, nunca ao vivo.
A perda máxima fica limitada pelo teto (**5 USDG por dia**) mais o que a hot wallet tiver. Na Safe
ficam uns **10 USDG**, e uns **5 dólares de ETH** para as taxas. O integrator guia-te ao vivo; a ordem:

1. **Uma carteira Phantom nova, com uma frase de recuperação nova**, só para isto — a regra de mainnet.
   Não a de teste, nem a do dia a dia. Frase em papel, nunca fotografada.
2. **Uma hot wallet nova de mainnet** (não a `rh-hot.key` de testnet), criada direto para um ficheiro
   sem a chave aparecer no ecrã, e o endereço dela no Vercel como `ROBINHOOD_HOT_WALLET_MAINNET`.
3. **Fundos pela ponte Across**: USDC da Solana, Base ou Arbitrum chega como USDG na Robinhood Chain;
   ETH pelo mesmo caminho. **Antes de mandar seja o que for para a Safe**, confirma que o token
   recebido é exatamente `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` — há dezenas de cópias.
4. **Criar a Safe** na página de assinatura, na Phantom nova. Depois mandar **10 USDG** para a Safe.
5. **Ligar o teto de 5 USDG por dia** (`5000000`) na mesma página.
6. **Pôr os segredos `ROBINHOOD_*` para a 4663 no Fly** e fazer redeploy do guard-core e do bot.
7. **A política do agente**: rede 4663, só o USDG de mainnet, **1 USDG por pagamento e 5 por dia**.
8. **Um pagamento x402** em USDG, com o dinheiro a voltar para uma conta tua.
9. **O kill**: `/kill` → **Confirm** no Telegram, e depois o botão da Robinhood Chain na Phantom.

---

## ✅ HUMAN-22 — Lançamento: Solana e Robinhood Chain com dinheiro real

**Feito em 2026-11-09:** as duas redes estão no ar com dinheiro real. O registo está no PR #139
(`LAUNCH.md`, relatório final, revisão de segurança).

**As tuas decisões de 2026-11-09** (no `LAUNCH.md`, §1), que substituem as de 2026-11-05 onde mudam:

|     | Decidido                                                                                       |
| --- | ---------------------------------------------------------------------------------------------- |
| D6  | **Solana e Robinhood Chain juntas** no lançamento; a Base depois                               |
| D1  | **20 por dia em cada rede**; cada hot wallet com no máximo 10                                  |
| D2  | **5 por pagamento, 20 por dia, aprovação acima de 1**                                          |
| D4  | **Uma só Phantom (uma frase) é dona dos dois cofres** — risco aceite, com as três regras da D4 |

Isto quer dizer que, se essa frase escapar, os dois cofres ficam expostos de uma vez. As três regras
da D4 (frase nova só para isto, conta que não faz mais nada, cofres com pouco) passam a valer a dobrar.

O integrator guia-te em cada bloco; aqui fica a ordem:

**A. O que não depende da rede**

1. ✅ Ensaio de recuperar a base de dados de uma cópia de segurança — passou: a cópia bateu com o
   sistema vivo na política, nos gastos, nos pedidos e nos 15 eventos de auditoria.
2. ✅ O que falta da revisão de segurança — passou (o bot não tem IP público, um token revogado deixa
   de funcionar na hora, zero segredos nos logs): `fly ips list` do bot, um token revogado testado ao vivo, e
   procurar segredos nos logs.
3. ⏳ Cópias de segurança automáticas da base de dados (14 dias de retenção) — falta a tua confirmação.
4. ✅ A página de assinatura no Vercel só publica a partir do `main`.
5. ✅ **Deploy automático no Fly** sempre que algo entra no `main` — acaba com o bot desatualizado.
   Depois de o integrator abrir o PR do workflow, crias um token de deploy por app e guardas cada um
   diretamente nos segredos do GitHub, sem ele aparecer no ecrã:

   ```bash
   fly tokens create deploy -a agentguard-guard-core | gh secret set FLY_API_TOKEN_GUARD --repo agent443-dot/AgentGuard
   ```

   ```bash
   fly tokens create deploy -a agentguard-bot | gh secret set FLY_API_TOKEN_BOT --repo agent443-dot/AgentGuard
   ```

**B. Robinhood Chain** — na Safe que já tens (`0xB460…9d8a`). ✅ **Lançada em 2026-11-09.**

6. ✅ Voltar a pôr o teto — o kill do piloto removeu-o — agora de **20 USDG por dia** (`amount=20000000`)
   na página de assinatura, e pôr no cofre o que quiseres
   para as primeiras semanas.
7. ✅ A política do agente com os valores da D2, e um pagamento de teste.

**C. Solana mainnet** — ✅ **lançada em 2026-11-09**, mais cedo do que o previsto. Multisig
`DrBC…TGvsL`, cofre `GDXd…CXna` com 20 USDC, teto de 20 USDC por dia.

8. ✅ Uma hot wallet nova de mainnet, criada direto para um ficheiro.
9. ✅ O multisig e o teto de **20 USDC por dia**, criados pela página de assinatura na tua Phantom.
10. ✅ Um RPC de mainnet para a Solana (o público tem limites), nos segredos do Fly.
11. ✅ Um kill de teste em mainnet, e repor o teto.

**D. Antes de abrir** — decisões D7 (código aberto, cada um aloja o seu) e D8 (licença Apache-2.0)

12. ✅ **Branch principal**: no GitHub, **Settings → General → Default branch**, troca para `main`
    (já é `main`).
13. ✅ **Proteger o `main`**: **Settings → Rules → Rulesets → New branch ruleset**, alvo `main`, com
    "Require a pull request before merging", "Require status checks to pass" (o CI) e
    "Block force pushes".
14. ✅ **Segurança**: em **Settings → Code security**, liga **Private vulnerability reporting**,
    **Secret scanning** e **Push protection**.
15. ✅ **Rever o que fica público.** A procura nos 494 commits não encontrou segredos, mas ao abrir o
    repositório ficam visíveis os emails dos commits e a pasta `coordination/` (este ficheiro incluído,
    com caminhos do teu computador e endereços das carteiras — públicos, mas teus). Diz-me se queres
    tirar alguma coisa antes.
16. ✅ A landing page, e o relatório final (#125).
17. ✅ **A tua autorização escrita para lançar** (`HUMAN-8`, 2026-11-09).
18. ✅ **Por último, tornar o repositório público** (feito em 2026-11-09): **Settings → General → Danger Zone → Change
    visibility → Public**. Logo a seguir entra a mudança que troca os "coming soon" do site pelo link
    do repositório.

---

## ⏳ HUMAN-25 — Pedir à Phantom que reveja o domínio da página de assinatura

Quando criaste o multisig na Solana mainnet, a Phantom marcou a transação como suspeita. Isso acontece
com domínios novos que ela ainda não conhece, e o aviso vai aparecer a quem usar a página. Pedes uma
revisão do domínio `agentguard-onchain.vercel.app` à Phantom:

1. Abre o formulário de revisão de domínios da Phantom. Não consegui confirmar o link daqui; pedi-o ao
   integrator e ponho-o aqui logo que o tiver.
2. Domínio: `agentguard-onchain.vercel.app`.
3. Descrição (em inglês, cola tal como está):
   "Open-source signing page for AgentGuard (github.com/agent443-dot/AgentGuard). It builds Squads v4
   multisig and spending-limit transactions for the owner's own wallet. No funds are sent to third
   parties; every address is public and checked onchain before signing."
4. Envia, e diz-me quando a Phantom responder.

---

## ⬜ HUMAN-26 — Publicar os pacotes no npm

Ainda não é preciso. Mais tarde, `create-agentguard` (o assistente de instalação) e
`@agentguard/mcp-server` vão para o npm, para quem quiser instalar com um só comando. Para isso precisas
de uma conta npm e de uma organização `agentguard`. Eu dou-te os passos quando os pacotes estiverem
prontos.

---

## ⬜ HUMAN-23 — Registar uma passkey para aprovar pagamentos (CR-010, fase 3)

Ainda não é preciso. Aprovaste o CR-010 em 2026-11-09. Na fase 3, as aprovações maiores pedem uma
passkey (a impressão digital ou o Face ID do teu telemóvel) além do botão do Telegram. Quando a fase 3
estiver no `main` (depois da Solana mainnet), eu dou-te os passos exatos para a registar.

---

## ⬜ HUMAN-24 — Criar a chave dos recibos (CR-010, fase 3)

Ainda não é preciso. Na fase 3, cada pagamento passa a ter um recibo assinado pelo guard-core. Essa
assinatura usa uma chave própria, que crias na tua máquina direto para um ficheiro e guardas nos
segredos do Fly, sem ela aparecer no ecrã. Eu dou-te o comando quando chegarmos lá.

---

## ⬜ HUMAN-7 — Contas de deploy

Só quando o `INT-3` estiver pronto. Vamos precisar de alojar o `guard-core` e o `telegram-bot`
(Fly.io ou Railway) e de um gestor de segredos para a chave da hot wallet. Eu digo-te exatamente o que
criar quando chegarmos lá.

---

## ✅ HUMAN-8 — Decisão e assinatura de mainnet

**Feito em 2026-11-09:** deste a autorização escrita para lançar. As decisões abaixo são as de
2026-11-05; as de 2026-11-09 (D1, D2, D4, D6, D7, D8) estão na `HUMAN-22` e no `LAUNCH.md`.

**As seis decisões foram tomadas por ti em 2026-11-05** e estão registadas no `LAUNCH.md` (PR #65):

|     | Decidido                                                             |
| --- | -------------------------------------------------------------------- |
| D1  | 50 USDC por dia; a hot wallet guarda no máximo 20                    |
| D2  | 5 USDC por pagamento, 25 por dia, aprovação acima de 1; deny-all     |
| D3  | Fly.io                                                               |
| D4  | **Phantom** para a chave da owner — risco aceite por ti (ver abaixo) |
| D5  | Secrets do Fly.io                                                    |
| D6  | Solana primeiro                                                      |

**Sobre a D4.** A chave da owner manda no cofre inteiro e é a única que faz o kill. Numa carteira de
software, quem tomar o teu computador ou telemóvel toma o cofre — por isso recomendei uma Ledger. A
decisão é tua e está registada assim. Três regras passam a ser obrigatórias com a Phantom:

1. **Uma frase de recuperação nova, só para isto.** Não uma conta nova dentro de uma Phantom que já
   tens: todas as contas de uma Phantom vêm da mesma frase, e se essa frase alguma vez escapou, todas
   escaparam. Cria uma carteira Phantom nova, com uma frase nova, escrita em papel e nunca fotografada.
2. **Essa conta não faz mais nada** — não liga a sites, não assina outras coisas, não guarda outros
   tokens. Assim nenhum site malicioso tem onde te pedir uma assinatura.
3. **O cofre fica com pouco.** Com o teto de 50 USDC por dia, mantém no cofre só o que precisas para
   umas semanas, e repõe à medida.

O bloqueio da Ledger foi trocado por um da Phantom: antes de mainnet, numa conta Phantom nova em devnet,
criar o multisig e o spending limit e fazer o kill **assinando na Phantom**. Estou a ver com a Sessão 1
o caminho mais simples para isso e para o kill ficar a um toque a partir do Telegram; dou-te os passos
quando estiver pronto.

O texto abaixo fica como registo de como chegámos aqui.

O último passo, e é inteiramente teu. Não avanço para aqui sem a tua decisão escrita.

O plano de lançamento está em [`/LAUNCH.md`](../LAUNCH.md), construído a partir do código real. Tem seis
decisões tuas em aberto, que te apresento uma a uma, com recomendação, **depois** de a `HUMAN-11`
correr — decidir antes de veres o sistema funcionar em devnet seria decidir às cegas:

|     | Decisão                                         |
| --- | ----------------------------------------------- |
| D1  | o teto diário em mainnet                        |
| D2  | a política de lançamento do agente              |
| D3  | onde alojar o guard-core e o bot                |
| D4  | a hardware wallet para a chave da owner         |
| D5  | o gestor de segredos para a chave da hot wallet |
| D6  | lançar só com Solana, ou esperar pela Base      |

**As minhas recomendações**, para leres com calma. Nenhuma está decidida; respondes a uma de cada vez
e eu registo a tua resposta no `LAUNCH.md`.

|     | Recomendo                                                                                                                                       | Porquê                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **50 USDC por dia** no arranque, com a hot wallet a guardar no máximo 20 USDC.                                                                  | A perda máxima num dia é o teto mais o que está na hot wallet: aqui, 70 USDC. Sobe-se depois de umas semanas sem incidentes; descer é que custa.                                                              |
| D2  | Cada agente novo: **5 USDC por pagamento, 25 por dia, aprovação no Telegram acima de 1 USDC**, e só os domínios que tu puseres na lista.        | Os pagamentos pequenos do x402 passam sozinhos; tudo o resto chega-te ao telemóvel. Começa em deny-all, como em devnet.                                                                                       |
| D3  | **Fly.io**, uma região, com um volume persistente para a base de dados e o guard-core só na rede privada; público só o webhook do bot, com TLS. | Tem volumes e rede privada entre serviços sem configuração extra, e o guard-core, que é quem assina, nunca fica exposto à internet.                                                                           |
| D4  | **Uma Ledger** (Nano S Plus chega).                                                                                                             | O código já assina com Ledger na Solana e está a ganhar o mesmo na Base. Falta só o teste com o aparelho verdadeiro em devnet.                                                                                |
| D5  | **Os secrets do próprio Fly.io**, escritos para um ficheiro em memória quando o guard-core arranca.                                             | Com o teto baixo do D1, um gestor de segredos externo acrescenta mais uma conta a proteger sem reduzir a perda máxima. O plano de rotação de chave já está no `LAUNCH.md`. KMS fica para quando o teto subir. |
| D6  | **Lançar só com Solana**, e a Base umas semanas depois.                                                                                         | A Solana já correu de ponta a ponta em devnet com dinheiro verdadeiro. A Base ainda não correu ao vivo (`HUMAN-12`), e lá a hot wallet pode mandar o teto do dia para qualquer endereço.                      |

E uma regra que não é decisão: **mainnet usa chaves novas, sempre.** As de devnet nunca se reutilizam
— uma das seed phrases já passou pelo chat.

Antes de mainnet têm também de estar fechados três bloqueios que o plano encontrou: o kill switch a
assinar com hardware wallet (`SVM-9`), o guard-core configurável para ser alojado (`GC-12`), e uma
forma de revogar o token de um agente (`GC-13`).
