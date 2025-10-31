import { Octokit } from '@octokit/rest';

// Initialize Octokit client
// You can set GITHUB_TOKEN environment variable or pass it directly
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Configuration for your GitHub repository
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'your-org';
const GITHUB_REPO = process.env.GITHUB_REPO || 'your-repo';
const WORKFLOW_FILE = process.env.WORKFLOW_FILE || 'build.yml'; // e.g., '.github/workflows/build.yml'

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

    const response = workflowId
      ? await octokit.rest.actions.listWorkflowRuns({
          ...baseParams,
          workflow_id: workflowId,
        })
      : await octokit.rest.actions.listWorkflowRunsForRepo(baseParams);

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
    await octokit.rest.actions.createWorkflowDispatch({
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

export function getWorkflowFile(): string {
  return WORKFLOW_FILE;
}

