import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function updateSprintStatus(
  implementationPath: string,
  storyKey: string,
  status: string,
): Promise<void> {
  const filePath = join(implementationPath, 'sprint-status.yaml')

  let content: string
  try {
    content = await readFile(filePath, 'utf-8')
  } catch {
    return // Silent no-op if file not found
  }

  // Match lines like `  1-2-frontend-project-initialization: backlog`
  // The [a-zA-Z] after the story key prefix prevents `1-2` from matching `1-20-...`
  const pattern = new RegExp(
    `^(\\s+${escapeRegExp(storyKey)}-[a-zA-Z][^:]*:)\\s+\\S+`,
    'm',
  )

  const match = pattern.exec(content)
  if (!match) return // Silent no-op if key not found

  const updated = content.replace(pattern, `$1 ${status}`)
  await writeFile(filePath, updated, 'utf-8')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
