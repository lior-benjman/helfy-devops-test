const { Kafka } = require('kafkajs');
const log4js = require('log4js');

const brokers = (process.env.KAFKA_BROKERS || 'kafka:9092')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const topic = process.env.KAFKA_TOPIC || 'flowershop_cdc';
const groupId = process.env.KAFKA_CONSUMER_GROUP || 'flowershop-cdc-group';

log4js.configure({
  appenders: {
    out: { type: 'stdout' },
  },
  categories: {
    default: { appenders: ['out'], level: process.env.LOG_LEVEL || 'info' },
  },
});

const logger = log4js.getLogger('cdc-consumer');

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

start().catch((error) => {
  logger.error(
    JSON.stringify({
      event: 'consumer_error',
      message: error.message,
      stack: error.stack,
    }),
  );
  process.exit(1);
});
