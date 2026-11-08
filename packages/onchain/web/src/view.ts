const app = document.getElementById('app')!

export function show(title: string, lines: string[], tone: 'info' | 'stop' | 'done' = 'info') {
  app.replaceChildren()
  app.dataset['state'] = tone
  const heading = document.createElement('h1')
  heading.textContent = title
  app.append(heading)
  for (const line of lines) {
    const p = document.createElement('p')
    p.textContent = line
    app.append(p)
  }
}

export function button(label: string, action: () => void) {
  const element = document.createElement('button')
  element.textContent = label
  element.addEventListener('click', action, { once: true })
  app.append(element)
}

export function link(label: string, href: string) {
  const element = document.createElement('a')
  element.href = href
  element.textContent = label
  app.append(element)
}

/** After the wallet has sent it: read the chain until the change is there, for about a minute. */
export async function waitFor(plan: {
  after: string
  landed: () => Promise<string[] | undefined>
}) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await plan.landed()
    if (result) {
      show(plan.after, result, 'done')
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  show(
    'Not confirmed yet',
    ['The change is not on the chain yet. Run status before trying again.'],
    'stop',
  )
}
