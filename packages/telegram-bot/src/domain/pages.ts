// Telegram refuses a message over 4096 characters; the page counter takes a few more.
const PAGE_LIMIT = 4000

/**
 * A header and its blocks as Telegram messages. A block never splits across two messages, so each
 * page reads on its own; more than one page is numbered.
 */
export function pages(header: string, blocks: string[]): string[] {
  const out: string[] = []
  let page = header
  for (const block of blocks) {
    if (page.length + 1 + block.length > PAGE_LIMIT) {
      out.push(page)
      page = block
    } else {
      page = `${page}\n${block}`
    }
  }
  out.push(page)
  return out.length === 1 ? out : out.map((text, i) => `(${i + 1}/${out.length}) ${text}`)
}
