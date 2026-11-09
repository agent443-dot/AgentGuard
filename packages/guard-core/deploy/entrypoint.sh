#!/bin/sh
# Fly.io hands secrets to the machine as environment variables (D5), and guard-core reads its hot
# keys from files. This moves each key into a file on tmpfs that only the app user can read, then
# drops the variable before node starts. The key stays out of node's environment, out of every child
# process and crash report, and never touches a disk.
set -eu

dir="${AGENTGUARD_KEY_DIR:-/run/agentguard}"
user="${AGENTGUARD_USER:-node}"
data="${AGENTGUARD_DATA_DIR:-/data}"
uid="$(id -u "$user")"
gid="$(id -g "$user")"

mkdir -p "$dir"
# Fail closed: if tmpfs cannot be mounted, set -e stops here before any key is written.
if [ "$(stat -f -c %T "$dir")" != tmpfs ]; then
  mount -t tmpfs -o size=64k,mode=0700 tmpfs "$dir"
fi
chown "$uid:$gid" "$dir"
chmod 700 "$dir"
umask 077

# printf is a shell builtin, so a key never shows up in any process's argv.
if [ -n "${SOLANA_HOT_WALLET_KEYPAIR_JSON:-}" ]; then
  printf '%s\n' "$SOLANA_HOT_WALLET_KEYPAIR_JSON" >"$dir/hot.json"
  chown "$uid:$gid" "$dir/hot.json"
  export SOLANA_HOT_WALLET_KEYPAIR="$dir/hot.json"
fi
if [ -n "${BASE_HOT_WALLET_KEY:-}" ]; then
  printf '%s\n' "$BASE_HOT_WALLET_KEY" >"$dir/base-hot"
  chown "$uid:$gid" "$dir/base-hot"
  export BASE_HOT_WALLET_KEY_FILE="$dir/base-hot"
fi
if [ -n "${ROBINHOOD_HOT_WALLET_KEY:-}" ]; then
  printf '%s\n' "$ROBINHOOD_HOT_WALLET_KEY" >"$dir/robinhood-hot"
  chown "$uid:$gid" "$dir/robinhood-hot"
  export ROBINHOOD_HOT_WALLET_KEY_FILE="$dir/robinhood-hot"
fi
if [ -n "${RECEIPT_SIGNING_KEY:-}" ]; then
  printf '%s\n' "$RECEIPT_SIGNING_KEY" >"$dir/receipt.pem"
  chown "$uid:$gid" "$dir/receipt.pem"
  export RECEIPT_SIGNING_KEY_FILE="$dir/receipt.pem"
fi
unset SOLANA_HOT_WALLET_KEYPAIR_JSON BASE_HOT_WALLET_KEY ROBINHOOD_HOT_WALLET_KEY RECEIPT_SIGNING_KEY

# Fly mounts the database volume owned by root.
if [ -d "$data" ]; then
  chown "$uid:$gid" "$data"
fi

exec setpriv --reuid="$uid" --regid="$gid" --clear-groups --no-new-privs -- "$@"
