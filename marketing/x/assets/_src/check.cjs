/* eslint-disable @typescript-eslint/no-require-imports, no-console -- a Node script outside the TS packages */
/* global require, __dirname, process, console */
// Checks every ```text block in marketing/x/*.md fits in one X post (280, each URL counted as 23).
// Also flags words the playbook bans. Usage: node marketing/x/assets/_src/check.cjs
const fs = require('fs')
const path = require('path')

const dir = path.resolve(__dirname, '../..')
const banned =
  /unhackable|100% safe|guaranteed|revolutionary|airdrop|\btoken price\b|\bpoints\b|\brewards?\b|to the moon|\$AG\b/i
const url = /https?:\/\/\S+/g

function weight(text) {
  const plain = text.replace(url, 'x'.repeat(23))
  // X counts emoji and CJK as 2; everything here is Latin, so code points are close enough.
  return Array.from(plain).length
}

let bad = 0
for (const f of fs
  .readdirSync(dir)
  .filter((n) => n.endsWith('.md'))
  .sort()) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8')
  const blocks = [...src.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1].trimEnd())
  blocks.forEach((b, i) => {
    const n = weight(b)
    const hit = b.match(banned)
    if (n > 280 || hit) {
      bad++
      console.log(
        `${f} block ${i + 1}: ${n} chars${hit ? `, banned word "${hit[0]}"` : ''}\n${b}\n`,
      )
    }
  })
  console.log(`${f}: ${blocks.length} posts, longest ${Math.max(0, ...blocks.map(weight))}`)
}
process.exit(bad ? 1 : 0)
