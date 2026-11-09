export const CLIENTS = ['claude-code', 'claude-desktop', 'cursor', 'generic'] as const
export type Client = (typeof CLIENTS)[number]

export interface Launch {
  command: string
  args: string[]
}

export interface SetupValues {
  name: string
  guardUrl: string
  agentId: string
  tokenFile: string
  launch: Launch
}

/** What to tell the person: never the token, only the file that holds it. */
export function renderClient(client: Client, values: SetupValues): string {
  switch (client) {
    case 'claude-code':
      return claudeCode(values)
    case 'claude-desktop':
      return jsonBlock(values, DESKTOP_PATHS, 'then restart Claude Desktop')
    case 'cursor':
      return jsonBlock(values, CURSOR_PATHS, 'then reload Cursor')
    case 'generic':
      return generic(values)
  }
}

const DESKTOP_PATHS = [
  'macOS: ~/Library/Application Support/Claude/claude_desktop_config.json',
  'Windows: %APPDATA%\\Claude\\claude_desktop_config.json',
  'Linux: ~/.config/Claude/claude_desktop_config.json',
]

const CURSOR_PATHS = ['every project: ~/.cursor/mcp.json', 'one project: .cursor/mcp.json']

function env(values: SetupValues): Record<string, string> {
  return {
    GUARD_URL: values.guardUrl,
    AGENT_ID: values.agentId,
    AGENT_TOKEN_FILE: values.tokenFile,
  }
}

function claudeCode(values: SetupValues): string {
  const flags = Object.entries(env(values)).map(([key, value]) => `-e ${quote(`${key}=${value}`)}`)
  const command = [
    'claude mcp add',
    quote(values.name),
    '--scope user',
    ...flags,
    '--',
    quote(values.launch.command),
    ...values.launch.args.map(quote),
  ].join(' ')
  return ['Run this once:', '', command, '', 'Then start Claude Code; /mcp lists the server.'].join(
    '\n',
  )
}

function jsonBlock(values: SetupValues, paths: string[], after: string): string {
  const config = {
    mcpServers: {
      [values.name]: { command: values.launch.command, args: values.launch.args, env: env(values) },
    },
  }
  return [
    `Add this to the "mcpServers" of your config file, ${after}:`,
    ...paths.map((path) => `  ${path}`),
    '',
    JSON.stringify(config, null, 2),
  ].join('\n')
}

function generic(values: SetupValues): string {
  const assignments = Object.entries(env(values)).map(([key, value]) => `${key}=${quote(value)}`)
  return [
    'Start the server over stdio with these variables in its environment:',
    '',
    [...assignments, quote(values.launch.command), ...values.launch.args.map(quote)].join(' '),
    '',
    'Any MCP client that launches a command can use it: the command, its arguments and the three',
    'variables above are all it needs.',
  ].join('\n')
}

/** POSIX single quotes: nothing inside is expanded, and a quote is closed, escaped and reopened. */
export function quote(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`
}
