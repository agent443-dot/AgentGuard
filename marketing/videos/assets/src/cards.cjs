// Branded card templates. Each returns the inner HTML of one frame; render.cjs wraps and shoots it.
const REPO = 'github.com/agent443-dot/AgentGuard'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Lines wrapped in *stars* get the brand gradient.
const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<span class="grad">$1</span>')

function frame(body, { tag, foot = 'Open source · Apache-2.0 · self-hosted' } = {}) {
  return `<div class="frame">
  ${tag ? `<span class="tag">${esc(tag)}</span>` : ''}
  <div class="brand"><i></i>AgentGuard</div>
  <div class="grow">${body}</div>
  <div class="foot"><span>${esc(foot)}</span><span>${REPO}</span></div>
</div>`
}

function title({ kicker, lines, sub, xl, tag }) {
  return frame(
    `${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}
     <h1 class="title${xl ? ' xl' : ''}">${lines.map(rich).join('<br>')}</h1>
     ${sub ? `<p class="sub">${rich(sub)}</p>` : ''}`,
    { tag },
  )
}

const FLOW = [
  ['Your vault', 'Squads multisig on Solana, Safe on EVM. Only your Phantom wallet controls it.'],
  ['Onchain daily cap', 'Squads spending limit or Safe Allowance Module. 24 h period. Enforced by the chain.'],
  ['Guard hot wallet', 'Small balance. Its key is held only by guard-core, never by the agent.'],
  ['x402 APIs and transfers', 'Paid only after policy, simulation and, above your threshold, your OK.'],
]

function flow({ kicker = 'Where the money lives', tag } = {}) {
  const nodes = FLOW.map(([b, s]) => `<div class="box node"><b>${b}</b><span>${s}</span></div>`)
  const arrows = ['↓ refills, never above the cap', '↓ pays', '']
  const body = nodes.map((n, i) => n + (arrows[i] ? `<div class="arrow">${arrows[i]}</div>` : '')).join('')
  return frame(`<div class="kicker">${kicker}</div>${body}`, { tag })
}

function formula({ cap = '20', hot = '10', note, tag }) {
  return frame(
    `<div class="kicker">Worst case, in writing</div>
     <h1 class="title">Max loss per day =<br><span class="grad">cap + hot wallet</span></h1>
     <div class="box eq">
       <div class="row"><span>Onchain daily cap (launch)</span><b>${cap}</b></div>
       <div class="row"><span>Hot wallet holds at most</span><b>${hot}</b></div>
       <hr>
       <div class="row"><span>Worst day, per chain</span><b class="grad">${Number(cap) + Number(hot)}</b></div>
     </div>
     <p class="sub">${rich(note || 'Holds even if guard-core is compromised. Dollars: USDG on Robinhood Chain, USDC on Solana.')}</p>`,
    { tag },
  )
}

function list({ kicker, heading, items, sub, tag }) {
  const li = items
    .map(([m, t, small]) => `<li><span class="m ${m === '✓' ? 'ok' : m === '✕' ? 'no' : m === '!' ? 'warn' : 'n'}">${esc(m)}</span><div>${rich(t)}${small ? `<small>${rich(small)}</small>` : ''}</div></li>`)
    .join('')
  return frame(
    `${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}
     ${heading ? `<h1 class="title">${heading.map(rich).join('<br>')}</h1>` : ''}
     <ul class="items">${li}</ul>${sub ? `<p class="sub">${rich(sub)}</p>` : ''}`,
    { tag },
  )
}

function table({ kicker, heading, rows, sub, tag }) {
  const tr = rows
    .map((r, i) => `<tr class="${i === rows.length - 1 && r.total ? 'total' : ''}"><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`)
    .join('')
  return frame(
    `<div class="kicker">${esc(kicker)}</div><h1 class="title">${heading.map(rich).join('<br>')}</h1>
     <div class="box"><table>${tr}</table></div>${sub ? `<p class="sub">${rich(sub)}</p>` : ''}`,
    { tag },
  )
}

function terminal({ kicker, heading, lines, sub, tag }) {
  const pre = lines
    .map((l) => (l.startsWith('#') ? `<span class="c">${esc(l)}</span>` : `<span class="p">$</span> ${esc(l)}`))
    .join('\n')
  return frame(
    `<div class="kicker">${esc(kicker)}</div>${heading ? `<h1 class="title">${heading.map(rich).join('<br>')}</h1>` : ''}
     <div class="term"><div class="bar"><i></i><i></i><i></i></div><pre>${pre}</pre></div>
     ${sub ? `<p class="sub">${rich(sub)}</p>` : ''}`,
    { tag },
  )
}

// Messages are [from, html, buttons?]. Bot text is taken from packages/telegram-bot/src.
function chat({ kicker, messages, tag }) {
  const m = messages
    .map(([from, html, btns]) =>
      from === 'me'
        ? `<div class="msg me">${esc(html)}</div>`
        : `<div class="msg"><div class="who">AgentGuard bot</div>${html}${btns ? `<div class="btns">${btns.map((b) => `<span class="${b.startsWith('!') ? 'hot' : ''}">${esc(b.replace(/^!/, ''))}</span>`).join('')}</div>` : ''}</div>`,
    )
    .join('')
  return frame(`<div class="kicker">${esc(kicker)}</div><div class="chat">${m}</div>`, { tag })
}

// Text is taken from packages/onchain/web/src; addresses are placeholders.
function sign({ kicker, url, heading, lines, tone = 'info', tag }) {
  return frame(
    `<div class="kicker">${esc(kicker)}</div>
     <div class="browser"><div class="url">${esc(url)}</div>
       <div class="page ${tone}"><h1>${esc(heading)}</h1>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div></div>`,
    { tag },
  )
}

function cta({ heading = ['Give your agent spending power,', '*not your keys.*'], items, tag }) {
  const li = items.map(([k, v]) => `<li><span class="m n">→</span><div>${esc(k)}<small class="mono">${esc(v)}</small></div></li>`).join('')
  return frame(
    `<h1 class="title">${heading.map(rich).join('<br>')}</h1>
     <div class="cta-url">${REPO}</div>
     <ul class="items">${li}</ul>`,
    { tag, foot: 'Open source · Apache-2.0 · no hosted service' },
  )
}

module.exports = { title, flow, formula, list, table, terminal, chat, sign, cta, REPO }
