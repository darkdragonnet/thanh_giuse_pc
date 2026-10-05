require('dotenv').config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: parseInt(process.env.REDIS_DB || '4', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectTimeout: 5000
};

const MAIN_QUEUE_NAME = 'hanet-registration';
const DLQ_QUEUE_NAME = 'hanet-registration-dlq';

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: 100,
  removeOnFail: false
};

module.exports = {
  redisConfig,
  MAIN_QUEUE_NAME,
  DLQ_QUEUE_NAME,
  defaultJobOptions
};
