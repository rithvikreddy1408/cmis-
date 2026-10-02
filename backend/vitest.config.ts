import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Unit tests need nothing running; integration tests need the Firebase
    // emulator and are driven by `npm run test:integration`, which starts it.
    // `npm run test:unit` narrows to the former so it stays runnable bare.
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
  },
})
