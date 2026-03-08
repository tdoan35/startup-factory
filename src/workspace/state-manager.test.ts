import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { StateManager } from './state-manager.js'

const TEST_EPICS = [
  { epicKey: 'epic-1', storyKeys: ['1-1', '1-2'] },
  { epicKey: 'epic-2', storyKeys: ['2-1'] },
]
const TEST_CONFIG = { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 }

describe('StateManager', () => {
  let tempDir: string
  let manager: StateManager

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'state-test-'))
    manager = new StateManager(tempDir)
  })

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('initialize() creates state.yaml at statePath', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await stat(manager.statePath)
  })

  it('initialize() sets run metadata correctly', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const state = await manager.read()
    expect(state.run.status).toBe('running')
    expect(state.run.totalCost).toBe(0)
    expect(state.run.config).toEqual(TEST_CONFIG)
    expect(state.run.started).toBeTruthy()
  })

  it('initialize() sets all stories to pending with zero attempts and cost', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const state = await manager.read()
    expect(state.epics['epic-1'].stories['1-1']).toEqual({
      status: 'pending',
      phase: 'pending',
      attempts: 0,
      cost: 0,
    })
  })

  it('read() returns a correctly typed AppState after initialize()', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const state = await manager.read()
    expect(state).toHaveProperty('run')
    expect(state).toHaveProperty('epics')
    expect(state.run.status).toBe('running')
    expect(Object.keys(state.epics)).toEqual(['epic-1', 'epic-2'])
  })

  it('read() throws on ENOENT when state.yaml does not exist', async () => {
    await expect(manager.read()).rejects.toThrow()
  })

  it('read() throws a descriptive error when state.yaml has invalid structure', async () => {
    await writeFile(manager.statePath, 'just_a_string: true\n')
    await expect(manager.read()).rejects.toThrow('invalid structure')
  })

  it('updateStory() merges updates and persists', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await manager.updateStory('epic-1', '1-1', { status: 'in-progress', phase: 'development', attempts: 1 })
    const state = await manager.read()
    expect(state.epics['epic-1'].stories['1-1'].status).toBe('in-progress')
    expect(state.epics['epic-1'].stories['1-1'].phase).toBe('development')
    expect(state.epics['epic-1'].stories['1-1'].attempts).toBe(1)
  })

  it('updateStory() correctly merges cost update and persists', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await manager.updateStory('epic-1', '1-1', { cost: 0.42 })
    const state = await manager.read()
    expect(state.epics['epic-1'].stories['1-1'].cost).toBe(0.42)
    expect(state.epics['epic-1'].stories['1-1'].status).toBe('pending')
  })

  it('concurrent updateStory() calls do not lose updates', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await Promise.all([
      manager.updateStory('epic-1', '1-1', { status: 'in-progress' }),
      manager.updateStory('epic-1', '1-2', { status: 'in-progress' }),
    ])
    const state = await manager.read()
    expect(state.epics['epic-1'].stories['1-1'].status).toBe('in-progress')
    expect(state.epics['epic-1'].stories['1-2'].status).toBe('in-progress')
  })

  it('updateStory() throws when epic key not found', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await expect(
      manager.updateStory('epic-99', '1-1', { status: 'completed' })
    ).rejects.toThrow()
  })

  it('updateStory() throws when story key not found', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await expect(
      manager.updateStory('epic-1', '9-9', { status: 'completed' })
    ).rejects.toThrow()
  })

  it('updateRun() merges partial updates and persists', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await manager.updateRun({ status: 'completed', totalCost: 1.23 })
    const state = await manager.read()
    expect(state.run.status).toBe('completed')
    expect(state.run.totalCost).toBe(1.23)
    expect(state.run.config).toEqual(TEST_CONFIG)
  })

  it('getStoriesByStatus() returns all pending stories initially', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const pending = await manager.getStoriesByStatus('pending')
    expect(pending).toHaveLength(3)
  })

  it('getStoriesByStatus() returns empty array when no match', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const completed = await manager.getStoriesByStatus('completed')
    expect(completed).toHaveLength(0)
  })

  it('getStoriesByStatus() filters correctly after updateStory()', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await manager.updateStory('epic-1', '1-1', { status: 'completed' })
    const completed = await manager.getStoriesByStatus('completed')
    expect(completed).toHaveLength(1)
    expect(completed[0].epicKey).toBe('epic-1')
    expect(completed[0].storyKey).toBe('1-1')
    const pending = await manager.getStoriesByStatus('pending')
    expect(pending).toHaveLength(2)
  })

  it('getStoryByKey() returns null when story key does not exist in any epic', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const result = await manager.getStoryByKey('9-9')
    expect(result).toBeNull()
  })

  it('getStoryByKey() returns correct entry with epicKey when story exists', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const result = await manager.getStoryByKey('1-2')
    expect(result).not.toBeNull()
    expect(result!.epicKey).toBe('epic-1')
    expect(result!.storyKey).toBe('1-2')
    expect(result!.status).toBe('pending')
  })

  it('getStoryByKey() returns updated state after updateStory()', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await manager.updateStory('epic-2', '2-1', { status: 'completed', phase: 'completed' })
    const result = await manager.getStoryByKey('2-1')
    expect(result).not.toBeNull()
    expect(result!.epicKey).toBe('epic-2')
    expect(result!.status).toBe('completed')
    expect(result!.phase).toBe('completed')
  })

  it('atomic write: .state.yaml.tmp does not exist after successful write', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await expect(stat(join(tempDir, '.state.yaml.tmp'))).rejects.toThrow()
  })

  it('initialize() marks completedStories as completed', async () => {
    const completedStories = new Set(['1-1'])
    await manager.initialize(TEST_EPICS, TEST_CONFIG, completedStories)
    const state = await manager.read()
    expect(state.epics['epic-1'].stories['1-1']).toEqual({
      status: 'completed',
      phase: 'completed',
      attempts: 0,
      cost: 0,
    })
    // Other stories remain pending
    expect(state.epics['epic-1'].stories['1-2'].status).toBe('pending')
    expect(state.epics['epic-2'].stories['2-1'].status).toBe('pending')
  })

  it('initialize() with empty completedStories set leaves all stories pending', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG, new Set())
    const state = await manager.read()
    expect(state.epics['epic-1'].stories['1-1'].status).toBe('pending')
    expect(state.epics['epic-1'].stories['1-2'].status).toBe('pending')
  })

  it('crash-safety: state.yaml is intact when .state.yaml.tmp exists as leftover', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const goodState = await manager.read()
    await writeFile(join(tempDir, '.state.yaml.tmp'), 'CORRUPTED PARTIAL CONTENT')
    const readState = await manager.read()
    expect(readState.run.status).toBe(goodState.run.status)
    expect(Object.keys(readState.epics)).toEqual(Object.keys(goodState.epics))
  })
})
