import { compact, parseEnvFile, type Source } from '../domain/env.js'
import type { Files } from './files.js'
import type { SourceReader } from './runner.js'

/** Reads each value at the moment it is fed to a child, and keeps none of them. */
export function sourceReader(files: Files): SourceReader {
  return async (source: Source) => {
    if ('value' in source) {
      return source.value
    }
    if ('secret' in source) {
      return parseEnvFile(await files.read(source.from))[source.secret] ?? ''
    }
    return compact(await files.read(source.file))
  }
}
