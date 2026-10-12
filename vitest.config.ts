import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts', 'web/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
