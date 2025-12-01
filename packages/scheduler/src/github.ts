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

const GITHUB_OWNER = 'software-mansion';
const GITHUB_REPO = 'rnrepo';

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

export async function scheduleLibraryBuild(
  libraryName: string,
  libraryVersion: string,
  platform: Platform,
  reactNativeVersion: string,
  workletsVersion: string = '',
  ref: string = 'main'
): Promise<void> {
  const platformPrefix = platform === 'android' ? ' 🤖 Android:' : ' 🍎 iOS:';

  console.log(
    platformPrefix,
    'Scheduling build for',
    libraryName,
    libraryVersion,
    'with React Native',
    reactNativeVersion,
    workletsVersion ? 'and worklets version: ' + workletsVersion : ''
  );

  try {
    const workflowId = getWorkflowFile(platform);
    await getOctokit().rest.actions.createWorkflowDispatch({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      workflow_id: workflowId,
      ref,
      inputs: {
        library_name: libraryName,
        library_version: libraryVersion,
        react_native_version: reactNativeVersion,
        worklets_version: workletsVersion,
      },
    });
    console.log(`  ✅ Workflow dispatched successfully`);
  } catch (error) {
    console.error(`  ❌ Failed to dispatch workflow:`, error);
    throw error;
  }
}

export function getWorkflowFile(platform: Platform): string {
  return WORKFLOW_FILES[platform];
}
