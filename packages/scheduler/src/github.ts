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

export async function scheduleLibraryBuild(
  libraryName: string,
  libraryVersion: string,
  platform: Platform,
  reactNativeVersion: string,
  ref: string = 'main'
): Promise<string | null> {
  const platformPrefix = platform === 'android' ? ' 🤖 Android:' : ' 🍎 iOS:';

  console.log(
    platformPrefix,
    'Scheduling build for',
    libraryName,
    libraryVersion,
    'with React Native',
    reactNativeVersion
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
      },
    });
    console.log(`  ✅ Workflow dispatched successfully`);

    // Get the workflow run URL by finding the most recent run for this workflow
    // Note: There's a small delay between dispatch and run creation, so we wait a bit
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const runs = await listWorkflowRuns(workflowId, ref, 'queued', 5);
      const platformLabel = platform === 'android' ? 'Android' : 'iOS';
      const expectedRunName = `Build for ${platformLabel} ${libraryName}@${libraryVersion} RN@${reactNativeVersion}`;

      // Find the matching run
      for (const run of runs) {
        if (run.name === expectedRunName && run.event === 'workflow_dispatch') {
          const runUrl =
            run.html_url ||
            `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${run.id}`;
          return runUrl;
        }
      }
    } catch (error) {
      console.warn(`  ⚠️  Could not fetch workflow run URL:`, error);
      // Return null if we can't get the URL, but don't fail the whole operation
    }

    return null;
  } catch (error) {
    console.error(`  ❌ Failed to dispatch workflow:`, error);
    throw error;
  }
}

export function getWorkflowFile(platform: Platform): string {
  return WORKFLOW_FILES[platform];
}
