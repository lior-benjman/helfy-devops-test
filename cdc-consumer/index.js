const { Kafka } = require('kafkajs');
const log4js = require('log4js');

// Normalize environment-driven Kafka settings so the container can adapt per deployment.
const brokers = (process.env.KAFKA_BROKERS || 'kafka:9092')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const topic = process.env.KAFKA_TOPIC || 'flowershop_cdc';
const groupId = process.env.KAFKA_CONSUMER_GROUP || 'flowershop-cdc-group';
// Optional env var controls how long to wait before reconnect attempts.
const retryDelayMs = Number(process.env.CDC_CONSUMER_RETRY_MS) || 5000;

// Emits CDC payloads to stdout in JSON so Docker logging can scrape structured events.
log4js.configure({
  appenders: {
    out: { type: 'stdout' },
  },
  categories: {
    default: { appenders: ['out'], level: process.env.LOG_LEVEL || 'info' },
  },
});

const logger = log4js.getLogger('cdc-consumer');

// Spins up a Kafka consumer that prints every TiCDC change event it receives.
async function start() {
  const kafka = new Kafka({
    clientId: 'flowershop-cdc-consumer',
    brokers,
  });

  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  logger.info(
    JSON.stringify({
      event: 'consumer_started',
      topic,
      brokers,
      groupId,
    }),
  );

  await consumer.run({
    eachMessage: async ({ topic: t, partition, message }) => {
      const payload = message.value ? message.value.toString('utf8') : '';
      let decoded = null;
      try {
        decoded = payload ? JSON.parse(payload) : null;
      } catch (error) {
        logger.warn(
          JSON.stringify({
            event: 'decode_failed',
            payload,
            error: error.message,
          }),
        );
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        action: 'cdc_event',
        topic: t,
        partition,
        offset: message.offset,
        key: message.key ? message.key.toString('utf8') : null,
        ip: 'tidb-cdc',
        payload: decoded || payload,
      };
      logger.info(JSON.stringify(logEntry));
    },
  });
}

// Keeps the consumer alive by retrying whenever Kafka is temporarily unavailable.
async function startWithRetry() {
  try {
    await start();
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: 'consumer_error',
        message: error.message,
        stack: error.stack,
      }),
    );

    logger.warn(
      JSON.stringify({
        event: 'consumer_retry_scheduled',
        delayMs: retryDelayMs,
      }),
    );

    setTimeout(startWithRetry, retryDelayMs);
  }
}

startWithRetry();
