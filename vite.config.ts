import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Agent worktrees live inside the repo; keep their copies out of test runs.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
})
