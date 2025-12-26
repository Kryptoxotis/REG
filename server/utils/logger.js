import winston from 'winston'
import fs from 'fs'

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY)

// Only create logs directory in non-serverless environments
if (!isServerless) {
  try {
    fs.mkdirSync('logs', { recursive: true })
  } catch {
    // Ignore mkdir errors in read-only filesystems
  }
}

// Build transports array based on environment
const transports = []

if (isServerless) {
  // Serverless: use console transport only (stdout/stderr for log aggregation)
  transports.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }))
} else {
  // Non-serverless: use file transports
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  )

  // Add console in development
  if (process.env.NODE_ENV !== 'production') {
    transports.push(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }))
  }
}

// Structured logging configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'reg-crm' },
  transports
})

export default logger
