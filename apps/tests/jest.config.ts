import type { Config } from 'jest'

const config: Config = {
  roots: ['<rootDir>'],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/**/__tests__/**/*.(ts|tsx|js)',
    '<rootDir>/**/*.(test|spec).(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // Map the Next.js app alias '@/...' to the app directory
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../app/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/../app/jest.setup.js'],
  // Allow imports from the Next.js project
  moduleDirectories: ['node_modules', '<rootDir>', '<rootDir>/../app'],
}

export default config
