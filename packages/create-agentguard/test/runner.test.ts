import { describe, expect, it } from 'vitest'
import { processRunner } from '../src/adapters/runner.js'
import { sourceReader } from '../src/adapters/sources.js'
import { memoryFiles } from './fakes.js'

const node = process.execPath
const env = '/home/owner/.agentguard/acme.env'
const files = memoryFiles({ [env]: 'ADMIN_TOKEN=s3cret\n' }).api

function runner() {
  const said: string[] = []
  return {
    said,
    runner: processRunner(sourceReader(files), (line) => said.push(line), '/home/owner'),
  }
}

describe('processRunner', () => {
  it('refuses a non-zero exit, naming the command and never its stdin', async () => {
    const { runner: r } = runner()
    const failing = r.run({
      cmd: node,
      args: ['-e', 'process.exit(3)'],
      stdin: { env: [['ADMIN_TOKEN', { secret: 'ADMIN_TOKEN', from: env }]] },
    })
    await expect(failing).rejects.toThrow(/failed \(exit code 3\)/)
    await expect(failing).rejects.not.toThrow(/s3cret/)
  })

  it('writes the secret to the child stdin only, and prints where it comes from', async () => {
    const { said, runner: r } = runner()
    const out = await r.run({
      cmd: node,
      args: ['-e', 'process.stdin.pipe(process.stdout)'],
      stdin: { env: [['ADMIN_TOKEN', { secret: 'ADMIN_TOKEN', from: env }]] },
      capture: true,
    })
    expect(out).toBe('ADMIN_TOKEN=s3cret\n')
    expect(said).toEqual([])
    await r.run({ cmd: node, args: ['-e', ''], stdin: { raw: { value: 'x' } } })
    expect(said[0]).toMatch(/^\$ .*node -e ''$/)
    expect(said.join('\n')).not.toContain('s3cret')
  })

  it('says when a command is not installed', async () => {
    const { runner: r } = runner()
    await expect(r.run({ cmd: 'no-such-tool-here', args: [], capture: true })).rejects.toThrow(
      'no-such-tool-here was not found: is it installed?',
    )
  })

  it('starts a background child and stops it', async () => {
    const { runner: r } = runner()
    const child = await r.start({ cmd: node, args: ['-e', 'setInterval(() => {}, 1000)'] })
    await child.stop()
    await child.stop()
  })
})
