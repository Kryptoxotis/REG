/**
 * Session Store Configuration
 *
 * Uses Redis for production (Upstash), falls back to memory store for development.
 * To enable Redis sessions, set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env
 */

import session from 'express-session'
import { Redis } from '@upstash/redis'
import logger from './logger.js'

// Custom Upstash Redis session store
class UpstashSessionStore extends session.Store {
  constructor(options = {}) {
    super()
    this.prefix = options.prefix || 'sess:'
    this.ttl = options.ttl || 86400 // 24 hours in seconds

    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    })

    logger.info('Redis session store initialized')
  }

  async get(sid, callback) {
    try {
      const data = await this.redis.get(this.prefix + sid)
      if (!data) {
        return callback(null, null)
      }
      const session = typeof data === 'string' ? JSON.parse(data) : data
      callback(null, session)
    } catch (err) {
      logger.error('Redis session get error', { error: err.message, sid })
      callback(err)
    }
  }

  async set(sid, session, callback) {
    try {
      const ttl = this._getTTL(session)
      const data = JSON.stringify(session)
      await this.redis.setex(this.prefix + sid, ttl, data)
      callback(null)
    } catch (err) {
      logger.error('Redis session set error', { error: err.message, sid })
      callback(err)
    }
  }

  async destroy(sid, callback) {
    try {
      await this.redis.del(this.prefix + sid)
      callback(null)
    } catch (err) {
      logger.error('Redis session destroy error', { error: err.message, sid })
      callback(err)
    }
  }

  async touch(sid, session, callback) {
    try {
      const ttl = this._getTTL(session)
      await this.redis.expire(this.prefix + sid, ttl)
      callback(null)
    } catch (err) {
      logger.error('Redis session touch error', { error: err.message, sid })
      callback(err)
    }
  }

  _getTTL(session) {
    if (session && session.cookie && session.cookie.maxAge) {
      return Math.ceil(session.cookie.maxAge / 1000)
    }
    return this.ttl
  }
}

/**
 * Get the appropriate session store based on environment
 * @returns {session.Store|undefined} Redis store for production, undefined for memory store
 */
export function getSessionStore() {
  const hasRedisConfig = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

  if (hasRedisConfig) {
    try {
      return new UpstashSessionStore({
        prefix: 'reg:sess:',
        ttl: 86400 // 24 hours
      })
    } catch (err) {
      logger.error('Failed to initialize Redis session store, falling back to memory store', {
        error: err.message
      })
      return undefined
    }
  }

  if (process.env.NODE_ENV === 'production') {
    logger.warn('Running in production without Redis session store. Sessions will be lost on restart.')
    logger.warn('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistent sessions.')
  }

  return undefined // Use default memory store
}

export default UpstashSessionStore
