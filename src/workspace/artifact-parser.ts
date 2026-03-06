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

export async function parseEpicsFromArtifacts(artifactsPath: string): Promise<EpicEntry[]> {
  const files = await readdir(artifactsPath)
  const epicsFile = files.find(f => /(epic|stories).*\.md$/i.test(f))
  if (!epicsFile) throw new Error(`No epics/stories file found in: ${artifactsPath}`)
  const content = await readFile(join(artifactsPath, epicsFile), 'utf-8')
  return parseEpicsContent(content)
}
