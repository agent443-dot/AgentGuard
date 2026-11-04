import { createRequire } from 'node:module'
import type SafeModule from '@safe-global/protocol-kit'

// The package's types describe its CommonJS build, so that is the build loaded: under an ESM import
// the class sits one level up from where the types put it.
const require = createRequire(import.meta.url)
export const { default: Safe } = require('@safe-global/protocol-kit') as typeof SafeModule
