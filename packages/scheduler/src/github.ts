import { Octokit } from '@octokit/rest';
import type { Platform } from './types';

// Initialize Octokit client
// GITHUB_TOKEN is provided via environment variable when running on Github Actions
export function createOctokit() {
  return new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
}

// Use a getter function to allow mocking in tests
let _octokit: Octokit | null = null;
function getOctokit(): Octokit {
  if (!_octokit) {
    _octokit = createOctokit();
  }
  return _octokit;
}

// Export setter for testing
export function setOctokit(octokit: Octokit | null) {
  _octokit = octokit;
}

const octokit = getOctokit();

const GITHUB_OWNER = 'software-mansion';
const GITHUB_REPO = 'buildle';

const WORKFLOW_FILES: Record<Platform, string> = {
  android: '.github/workflows/build-library-android.yml',
  ios: '.github/workflows/build-library-ios.yml',
};

export async function listWorkflowRuns(
  workflowId?: string | number,
  branch?: string,
  status?:
    | 'completed'
    | 'action_required'
    | 'cancelled'
    | 'failure'
    | 'neutral'
    | 'skipped'
    | 'stale'
    | 'success'
    | 'timed_out'
    | 'in_progress'
    | 'queued'
    | 'requested'
    | 'waiting'
    | 'pending',
  limit: number = 10
) {
  try {
    const baseParams = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      per_page: limit,
      ...(branch && { branch }),
      ...(status && { status }),
    };

    const client = getOctokit();
    const response = workflowId
      ? await client.rest.actions.listWorkflowRuns({
          ...baseParams,
          workflow_id: workflowId,
        })
      : await client.rest.actions.listWorkflowRunsForRepo(baseParams);

    return response.data.workflow_runs;
  } catch (error) {
    console.error('Error listing workflow runs:', error);
    throw error;
  }
}

export async function dispatchWorkflow(
  workflowId: string | number,
  inputs?: Record<string, string>,
  ref: string = 'main'
) {
  try {
    await getOctokit().rest.actions.createWorkflowDispatch({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      workflow_id: workflowId,
      ref,
      inputs,
    });
    return true;
  } catch (error) {
    console.error('Error dispatching workflow:', error);
    throw error;
  }
}

export function getWorkflowFile(platform: Platform): string {
  return WORKFLOW_FILES[platform];
}

/**
 * Checks if a workflow run exists for the given library name, version, React Native version, and platform in the past N days.
 * Returns true if a matching workflow run is found, false otherwise.
 */
export async function hasRecentWorkflowRun(
  libraryName: string,
  libraryVersion: string,
  reactNativeVersion: string,
  platform: Platform,
  daysBack: number = 3
): Promise<boolean> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Get workflow runs from all workflows for the past daysBack days
    // We need to fetch enough runs to cover the time period
    // GitHub API returns most recent first, so we fetch a reasonable number
    const client = getOctokit();
    const response = await client.rest.actions.listWorkflowRunsForRepo({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      per_page: 100, // Fetch more to ensure we cover the time period
    });

    const runs = response.data.workflow_runs;

    // Filter runs to those in the past N days and check their run name
    // Runs are sorted by most recent first, so we can break early once we pass the cutoff
    // Run name format: "Build for <platform> <library_name>@<library_version> RN@<react_native_version>"
    const platformLabel = platform === 'android' ? 'Android' : 'iOS';
    const expectedRunName = `Build for ${platformLabel} ${libraryName}@${libraryVersion} RN@${reactNativeVersion}`;

    for (const run of runs) {
      // Skip if run is too old - since runs are sorted by most recent first, we can break
      const runDate = new Date(run.created_at);
      if (runDate < cutoffDate) {
        break; // No more runs in our time window
      }

      // Check if this run has matching run name
      // Only workflow_dispatch runs will have our custom run-name format
      if (run.event !== 'workflow_dispatch') {
        continue;
      }

      // Check if run name matches expected format
      // Run name format: "Build for <platform> <library_name>@<library_version> RN@<react_native_version>"
      if (run.name === expectedRunName) {
        return true; // Found a matching run
      }
    }

    return false; // No matching run found
  } catch (error) {
    console.error('Error checking recent workflow runs:', error);
    // On error, return false to allow scheduling (fail open)
    return false;
  }
}
