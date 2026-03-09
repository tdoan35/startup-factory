import { defineConfig } from 'tsup'
import { cp, readdir } from 'node:fs/promises'
import { join } from 'node:path'

async function copyMdFiles(srcDir: string, destDir: string): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)
    if (entry.isDirectory()) {
      await copyMdFiles(srcPath, destPath)
    } else if (entry.name.endsWith('.md')) {
      await cp(srcPath, destPath, { force: true })
    }
  }
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: false,
  banner: {
    js: `#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);`
  },
  async onSuccess() {
    await copyMdFiles('src', 'dist')
  },
})
