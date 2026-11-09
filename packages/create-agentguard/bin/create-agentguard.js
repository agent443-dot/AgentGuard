#!/usr/bin/env node
// The workspace packages ship TypeScript sources, so the wizard runs them through tsx.
import { register } from 'tsx/esm/api'

register()
await import('../src/index.ts')
