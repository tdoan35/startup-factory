import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'

const STORY_KEY_PREFIX = /^(\d+-\d+)-/

export function parseSprintStatus(content: string): Map<string, string> {
  const result = new Map<string, string>()
  const parsed = parse(content) as Record<string, unknown> | null
  if (!parsed || typeof parsed !== 'object') return result

  const devStatus = parsed.development_status
  if (!devStatus || typeof devStatus !== 'object') return result

  for (const [key, value] of Object.entries(devStatus as Record<string, unknown>)) {
    const match = STORY_KEY_PREFIX.exec(key)
    if (match && typeof value === 'string') {
      result.set(match[1], value)
    }
  }

  return result
}

export async function readSprintStatus(artifactsDir: string): Promise<Map<string, string>> {
  const candidates = [
    // When artifactsDir is `_bmad-output/planning-artifacts/`, check sibling
    join(resolve(artifactsDir), '..', 'implementation-artifacts', 'sprint-status.yaml'),
    // Walk up from artifactsDir looking for the BMAD structure
    join(resolve(artifactsDir), '..', '..', '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
  ]

  for (const candidate of candidates) {
    try {
      const content = await readFile(candidate, 'utf-8')
      return parseSprintStatus(content)
    } catch {
      // File not found — try next candidate
    }
  }

  return new Map()
}
