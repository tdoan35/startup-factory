import { readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import type {
  AppState,
  RunMeta,
  StoryState,
  StoryStatus,
  StoryPhase,
  ConfigSnapshot,
} from './types.js'

export class StateManager {
  readonly statePath: string
  private readonly tempPath: string
  private mutexChain: Promise<void> = Promise.resolve()

  constructor(workspacePath: string) {
    this.statePath = join(workspacePath, 'state.yaml')
    this.tempPath = join(workspacePath, '.state.yaml.tmp')
  }

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.mutexChain.then(fn)
    this.mutexChain = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private async tryReadPreviousState(): Promise<AppState | null> {
    try {
      return await this.read()
    } catch {
      return null
    }
  }

  async initialize(
    epics: Array<{ epicKey: string; storyKeys: string[] }>,
    config: ConfigSnapshot,
    completedStories?: Set<string>,
    fresh?: boolean,
  ): Promise<void> {
    const previousState = fresh ? null : await this.tryReadPreviousState()

    const state: AppState = {
      run: {
        status: 'running',
        started: new Date().toISOString(),
        config,
        totalCost: 0,
      },
      epics: Object.fromEntries(
        epics.map(({ epicKey, storyKeys }) => [
          epicKey,
          {
            status: 'pending' as const,
            stories: Object.fromEntries(
              storyKeys.map(key => {
                const isCompleted = completedStories?.has(key)
                if (isCompleted) {
                  return [key, { status: 'completed' as StoryStatus, phase: 'completed' as StoryPhase, attempts: 0, cost: 0 }]
                }

                // Check previous state for resumption
                const oldStory = previousState?.epics[epicKey]?.stories[key]
                if (oldStory) {
                  if (oldStory.status === 'completed') {
                    return [key, { status: 'completed' as StoryStatus, phase: 'completed' as StoryPhase, attempts: 0, cost: 0 }]
                  }
                  if (oldStory.status === 'in-progress' && oldStory.phase !== 'pending') {
                    return [key, {
                      status: 'pending' as StoryStatus,
                      phase: 'pending' as StoryPhase,
                      attempts: 0,
                      cost: 0,
                      resumeFromPhase: oldStory.phase as StoryPhase,
                    }]
                  }
                }

                return [key, { status: 'pending' as StoryStatus, phase: 'pending' as StoryPhase, attempts: 0, cost: 0 }]
              })
            ),
          },
        ])
      ),
    }
    await this.write(state)
  }

  async read(): Promise<AppState> {
    const content = await readFile(this.statePath, 'utf-8')
    const state = parse(content) as AppState
    if (!state || typeof state.run !== 'object' || typeof state.epics !== 'object') {
      throw new Error(`State file has invalid structure: ${this.statePath}`)
    }
    return state
  }

  private async write(state: AppState): Promise<void> {
    await writeFile(this.tempPath, stringify(state))
    await rename(this.tempPath, this.statePath)
  }

  async updateStory(
    epicKey: string,
    storyKey: string,
    updates: Partial<StoryState>,
  ): Promise<void> {
    return this.withLock(async () => {
      const state = await this.read()
      const story = state.epics[epicKey]?.stories[storyKey]
      if (!story) {
        throw new Error(`Story not found in state: ${epicKey}/${storyKey}`)
      }
      state.epics[epicKey].stories[storyKey] = { ...story, ...updates }
      await this.write(state)
    })
  }

  async updateRun(updates: Partial<RunMeta>): Promise<void> {
    return this.withLock(async () => {
      const state = await this.read()
      state.run = { ...state.run, ...updates }
      await this.write(state)
    })
  }

  async getStoryByKey(
    storyKey: string,
  ): Promise<({ epicKey: string; storyKey: string } & StoryState) | null> {
    const state = await this.read()
    for (const [epicKey, epic] of Object.entries(state.epics)) {
      const story = epic.stories[storyKey]
      if (story) {
        return { epicKey, storyKey, ...story }
      }
    }
    return null
  }

  async getStoriesByStatus(
    status: StoryStatus,
  ): Promise<Array<{ epicKey: string; storyKey: string } & StoryState>> {
    const state = await this.read()
    const results: Array<{ epicKey: string; storyKey: string } & StoryState> = []
    for (const [epicKey, epic] of Object.entries(state.epics)) {
      for (const [storyKey, story] of Object.entries(epic.stories)) {
        if (story.status === status) {
          results.push({ epicKey, storyKey, ...story })
        }
      }
    }
    return results
  }
}
