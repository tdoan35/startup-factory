import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface EpicEntry {
  epicKey: string
  storyKeys: string[]
}

export function parseEpicsContent(content: string): EpicEntry[] {
  const lines = content.split('\n')
  const epics: EpicEntry[] = []
  let current: EpicEntry | null = null

  for (const line of lines) {
    const epicMatch = line.match(/^## Epic (\d+):/)
    if (epicMatch) {
      if (current) epics.push(current)
      current = { epicKey: `epic-${epicMatch[1]}`, storyKeys: [] }
      continue
    }
    const storyMatch = line.match(/^### Story (\d+)\.(\d+):/)
    if (storyMatch && current) {
      current.storyKeys.push(`${storyMatch[1]}-${storyMatch[2]}`)
    }
  }
  if (current) epics.push(current)
  return epics
}

export interface EpicRange {
  from?: number
  to?: number
}

export function parseEpicRange(range: string): EpicRange {
  if (/^\d+$/.test(range)) {
    const n = parseInt(range, 10)
    return { from: n, to: n }
  }
  const match = /^(\d*)-(\d*)$/.exec(range)
  if (!match || (match[1] === '' && match[2] === '')) {
    throw new Error(`Invalid epic range: "${range}". Use N, N-M, N-, or -M.`)
  }
  return {
    from: match[1] ? parseInt(match[1], 10) : undefined,
    to: match[2] ? parseInt(match[2], 10) : undefined,
  }
}

export function filterEpicsByRange(
  epics: EpicEntry[],
  range: EpicRange,
): EpicEntry[] {
  return epics.filter(e => {
    const num = parseInt(e.epicKey.replace('epic-', ''), 10)
    if (isNaN(num)) return false
    if (range.from !== undefined && num < range.from) return false
    if (range.to !== undefined && num > range.to) return false
    return true
  })
}

export async function parseEpicsFromArtifacts(artifactsPath: string): Promise<EpicEntry[]> {
  const files = await readdir(artifactsPath)
  const epicsFile = files.find(f => /(epic|stories).*\.md$/i.test(f))
  if (!epicsFile) throw new Error(`No epics/stories file found in: ${artifactsPath}`)
  const content = await readFile(join(artifactsPath, epicsFile), 'utf-8')
  return parseEpicsContent(content)
}
