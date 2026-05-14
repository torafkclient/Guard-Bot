const winston = require('winston');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const { combine, timestamp, printf, colorize } = winston.format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `[${timestamp}] ${level}: ${message}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    myFormat
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        myFormat
      )
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  ]
});

const customLogger = {
  error: (message) => {
    console.log(chalk.red(`[HATA] ${message}`));
    logger.error(message);
  },
  warn: (message) => {
    console.log(chalk.yellow(`[UYARI] ${message}`));
    logger.warn(message);
  },
  info: (message) => {
    console.log(chalk.blue(`[BİLGİ] ${message}`));
    logger.info(message);
  },
  success: (message) => {
    console.log(chalk.green(`[BAŞARI] ${message}`));
    logger.info(`[BAŞARI] ${message}`);
  },
  debug: (message) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(chalk.magenta(`[DEBUG] ${message}`));
      logger.debug(message);
    }
  },
  guard: (message) => {
    console.log(chalk.bgRed.white(`[GUARD] ${message}`));
    logger.warn(`[GUARD] ${message}`);
  },
  event: (message) => {
    console.log(chalk.cyan(`[EVENT] ${message}`));
    logger.info(`[EVENT] ${message}`);
  },
  command: (message) => {
    console.log(chalk.magenta(`[KOMUT] ${message}`));
    logger.info(`[KOMUT] ${message}`);
  },
  database: (message) => {
    console.log(chalk.blue(`[DB] ${message}`));
    logger.info(`[DB] ${message}`);
  }
};

module.exports = customLogger;
