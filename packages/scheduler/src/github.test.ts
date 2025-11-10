import { test, expect, beforeEach, afterEach } from 'bun:test';
import {
  getWorkflowFile,
  setOctokit,
  createOctokit,
} from './github';

beforeEach(() => {
  // Reset octokit before each test
  setOctokit(null);
});

afterEach(() => {
  // Clean up after each test
  setOctokit(null);
});

test('getWorkflowFile - returns correct workflow file for platform', () => {
  expect(getWorkflowFile('android')).toBe(
    '.github/workflows/build-library-android.yml'
  );
  expect(getWorkflowFile('ios')).toBe(
    '.github/workflows/build-library-ios.yml'
  );
});
