const log4js = require('log4js');

// Configures log4js to send JSON logs to stdout so Docker captures structured events.
log4js.configure({
  appenders: {
    out: { type: 'stdout' },
  },
  categories: {
    default: { appenders: ['out'], level: process.env.LOG_LEVEL || 'info' },
  },
});

// Shared logger instance keeps formatting identical across the API.
const logger = log4js.getLogger('api');

module.exports = logger;
