import { runScheduler } from './src/scheduler';

const limit = process.env.SCHEDULER_LIMIT
  ? parseInt(process.env.SCHEDULER_LIMIT, 10)
  : undefined;

if (limit !== undefined && (isNaN(limit) || limit < 1)) {
  console.error('Invalid SCHEDULER_LIMIT value. Must be a positive integer.');
  process.exit(1);
}

runScheduler(limit).catch((error) => {
  console.error('Scheduler failed:', error);
  process.exit(1);
});
