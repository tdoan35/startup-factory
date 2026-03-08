import { vi, describe, it, expect } from 'vitest'
import { parseEpicsContent, parseEpicsFromArtifacts, parseEpicRange, filterEpicsByRange } from './artifact-parser.js'
import type { EpicEntry } from './artifact-parser.js'

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

describe('parseEpicRange', () => {
  it('parses single number', () => {
    expect(parseEpicRange('1')).toEqual({ from: 1, to: 1 })
  })

  it('parses range N-M', () => {
    expect(parseEpicRange('1-3')).toEqual({ from: 1, to: 3 })
  })

  it('parses open-ended start -M', () => {
    expect(parseEpicRange('-3')).toEqual({ from: undefined, to: 3 })
  })

  it('parses open-ended end N-', () => {
    expect(parseEpicRange('2-')).toEqual({ from: 2, to: undefined })
  })

  it('throws on invalid input', () => {
    expect(() => parseEpicRange('abc')).toThrow('Invalid epic range: "abc"')
  })

  it('throws on empty dash', () => {
    expect(() => parseEpicRange('-')).toThrow('Invalid epic range: "-"')
  })
})

describe('filterEpicsByRange', () => {
  const epics: EpicEntry[] = [
    { epicKey: 'epic-1', storyKeys: ['1-1'] },
    { epicKey: 'epic-2', storyKeys: ['2-1'] },
    { epicKey: 'epic-3', storyKeys: ['3-1'] },
    { epicKey: 'epic-4', storyKeys: ['4-1'] },
  ]

  it('filters to single epic', () => {
    const result = filterEpicsByRange(epics, { from: 2, to: 2 })
    expect(result).toEqual([{ epicKey: 'epic-2', storyKeys: ['2-1'] }])
  })

  it('filters to range', () => {
    const result = filterEpicsByRange(epics, { from: 2, to: 3 })
    expect(result.map(e => e.epicKey)).toEqual(['epic-2', 'epic-3'])
  })

  it('filters with open-ended start', () => {
    const result = filterEpicsByRange(epics, { from: undefined, to: 2 })
    expect(result.map(e => e.epicKey)).toEqual(['epic-1', 'epic-2'])
  })

  it('filters with open-ended end', () => {
    const result = filterEpicsByRange(epics, { from: 3, to: undefined })
    expect(result.map(e => e.epicKey)).toEqual(['epic-3', 'epic-4'])
  })

  it('returns empty for no matches', () => {
    const result = filterEpicsByRange(epics, { from: 99, to: 99 })
    expect(result).toEqual([])
  })
})
