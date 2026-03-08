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

  async initialize(
    epics: Array<{ epicKey: string; storyKeys: string[] }>,
    config: ConfigSnapshot,
    completedStories?: Set<string>,
  ): Promise<void> {
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
                return [
                  key,
                  {
                    status: (isCompleted ? 'completed' : 'pending') as StoryStatus,
                    phase: (isCompleted ? 'completed' : 'pending') as StoryPhase,
                    attempts: 0,
                    cost: 0,
                  },
                ]
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
