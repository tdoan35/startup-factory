import { vi, describe, it, expect } from 'vitest'
import { parseEpicsContent, parseEpicsFromArtifacts } from './artifact-parser.js'

const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockReadFile: vi.fn(),
}))
vi.mock('node:fs/promises', () => ({ readdir: mockReaddir, readFile: mockReadFile }))

const sampleEpicsContent = `
## Epic 1: Project Foundation & Configuration

### Story 1.1: Project Scaffold & CLI Entry Point

Some description here.

### Story 1.2: Configuration Loading & CLI Flag Merging

Another description.

## Epic 2: Workspace Management

### Story 2.1: Workspace Initialization & Directory Structure

Description.
`

describe('parseEpicsContent', () => {
  it('produces correct epicKeys and storyKeys for multi-epic content', () => {
    const result = parseEpicsContent(sampleEpicsContent)
    expect(result).toHaveLength(2)
    expect(result[0].epicKey).toBe('epic-1')
    expect(result[0].storyKeys).toEqual(['1-1', '1-2'])
    expect(result[1].epicKey).toBe('epic-2')
    expect(result[1].storyKeys).toEqual(['2-1'])
  })

  it('returns [] for empty string', () => {
    expect(parseEpicsContent('')).toEqual([])
  })

  it('returns epic with empty storyKeys when epic has no stories', () => {
    const content = `## Epic 1: Empty Epic\n\nNo stories here.\n`
    const result = parseEpicsContent(content)
    expect(result).toHaveLength(1)
    expect(result[0].epicKey).toBe('epic-1')
    expect(result[0].storyKeys).toEqual([])
  })

  it('ignores story headings that appear before any epic heading', () => {
    const content = `### Story 1.1: Orphan\n\n## Epic 1: Real Epic\n\n### Story 1.2: Child\n`
    const result = parseEpicsContent(content)
    expect(result).toHaveLength(1)
    expect(result[0].epicKey).toBe('epic-1')
    expect(result[0].storyKeys).toEqual(['1-2'])
  })

  it('parses the epics.md format used in this project', () => {
    const projectSample = `## Epic 1: Project Foundation & Configuration\n\n### Story 1.1: Project Scaffold & CLI Entry Point\n\n### Story 1.2: Configuration Loading & CLI Flag Merging\n\n### Story 1.3: Error Types & Exit Codes\n\n## Epic 2: Workspace Management\n\n### Story 2.1: Workspace Initialization & Directory Structure\n`
    const result = parseEpicsContent(projectSample)
    expect(result[0].epicKey).toBe('epic-1')
    expect(result[0].storyKeys).toEqual(['1-1', '1-2', '1-3'])
    expect(result[1].epicKey).toBe('epic-2')
    expect(result[1].storyKeys).toEqual(['2-1'])
  })
})

describe('parseEpicsFromArtifacts', () => {
  it('throws when no epics/stories file is found in artifacts directory', async () => {
    mockReaddir.mockResolvedValue(['prd.md', 'architecture.md'])
    await expect(parseEpicsFromArtifacts('/some/path')).rejects.toThrow(
      'No epics/stories file found in: /some/path',
    )
  })

  it('parses epics from the matching file in the artifacts directory', async () => {
    mockReaddir.mockResolvedValue(['prd.md', 'epics.md'])
    mockReadFile.mockResolvedValue('## Epic 1: Test\n\n### Story 1.1: Story\n')
    const result = await parseEpicsFromArtifacts('/artifacts')
    expect(result).toEqual([{ epicKey: 'epic-1', storyKeys: ['1-1'] }])
  })
})
