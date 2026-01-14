// const { Kafka } = require('kafkajs');
// const config = require('./config');
// const logger = require('./logger');
//
// // Spins up a Kafka consumer inside the API so CDC events are logged next to other logs.
// async function startCdcConsumer() {
//   if (!config.cdc.enabled) {
//     logger.info(
//       JSON.stringify({
//         action: 'cdc_consumer_disabled',
//         reason: 'ENABLE_CDC_LOGS=false',
//       }),
//     );
//     return;
//   }
//
//   const kafka = new Kafka({
//     clientId: 'flowershop-api-cdc',
//     brokers: config.cdc.brokers,
//   });
//
//   const consumer = kafka.consumer({ groupId: config.cdc.groupId });
//   await consumer.connect();
//   await consumer.subscribe({ topic: config.cdc.topic, fromBeginning: false });
//
//   logger.info(
//     JSON.stringify({
//       action: 'cdc_consumer_started',
//       topic: config.cdc.topic,
//       brokers: config.cdc.brokers,
//       groupId: config.cdc.groupId,
//     }),
//   );
//
//   await consumer.run({
//     eachMessage: async ({ topic, partition, message }) => {
//       const payloadText = message.value ? message.value.toString('utf8') : '';
//       let payload = payloadText;
//       try {
//         payload = payloadText ? JSON.parse(payloadText) : null;
//       } catch (error) {
//         logger.warn(
//           JSON.stringify({
//             action: 'cdc_decode_failed',
//             error: error.message,
//             payload: payloadText,
//           }),
//         );
//       }
//
//       logger.info(
//         JSON.stringify({
//           timestamp: new Date().toISOString(),
//           action: 'cdc_event',
//           topic,
//           partition,
//           offset: message.offset,
//           key: message.key ? message.key.toString('utf8') : null,
//           payload,
//         }),
//       );
//     },
//   });
// }
//
// // Keeps trying whenever Kafka is temporarily unavailable so CDC logs are resilient.
// function startCdcConsumerWithRetry() {
//   startCdcConsumer().catch((error) => {
//     logger.error(
//       JSON.stringify({
//         action: 'cdc_consumer_error',
//         message: error.message,
//       }),
//     );
//     setTimeout(startCdcConsumerWithRetry, config.cdc.retryMs);
//   });
// }
//
// module.exports = {
//   startCdcConsumerWithRetry,
// };
