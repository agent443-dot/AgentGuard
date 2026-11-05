import { Buffer } from 'buffer'

// web3.js and the Squads SDK expect Node's Buffer. Imported first, so it exists before they load.
globalThis.Buffer = Buffer
