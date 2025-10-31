import { Octokit } from '@octokit/rest';
import { paginateRest } from '@octokit/plugin-paginate-rest';
import type { Platform } from './types';

// Initialize Octokit client with pagination plugin
// GITHUB_TOKEN is provided via environment variable when running on Github Actions
const MyOctokit = Octokit.plugin(paginateRest);
export function createOctokit() {
  return new MyOctokit({
    auth: process.env.GITHUB_TOKEN,
  });
}

// Use a getter function to allow mocking in tests
let _octokit: InstanceType<typeof MyOctokit> | null = null;
function getOctokit(): InstanceType<typeof MyOctokit> {
  if (!_octokit) {
    _octokit = createOctokit();
  }
  return _octokit;
}

// Export setter for testing
export function setOctokit(octokit: InstanceType<typeof MyOctokit> | null) {
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

    // Format date as YYYY-MM-DD for GitHub API
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];
    // Use >= format to get runs from cutoffDate onwards
    const createdFilter = `>=${cutoffDateString}`;

    // Get workflow runs filtered by date and branch using pagination
    // GitHub API will filter by creation date and main branch
    // Use paginate to fetch all pages of results
    const client = getOctokit();
    const runs = await client.paginate(
      client.rest.actions.listWorkflowRunsForRepo,
      {
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        branch: 'main', // Only runs from main branch
        created: createdFilter, // Only runs created on or after cutoffDate
      }
    );

    // Check run names - GitHub API already filtered by date and branch
    // Run name format: "Build for <platform> <library_name>@<library_version> RN@<react_native_version>"
    const platformLabel = platform === 'android' ? 'Android' : 'iOS';
    const expectedRunName = `Build for ${platformLabel} ${libraryName}@${libraryVersion} RN@${reactNativeVersion}`;

    for (const run of runs) {
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
