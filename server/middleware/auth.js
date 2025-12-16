import logger from '../utils/logger.js'

/**
 * #4 - Role-Based Access Control (RBAC) Middleware
 * Ensures only authorized users can access protected routes
 */

/**
 * Require user to be authenticated
 */
export function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  next()
}

/**
 * Require user to be an admin
 */
export function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

/**
 * Require user to be either admin OR the owner of the resource
 * Useful for endpoints where users can edit their own data
 *
 * SECURITY: Only uses req.params (URL params) for ownership check.
 * Never trust req.body for authorization - it can be manipulated by attackers.
 * The route must include the userId as a URL parameter (e.g., /users/:userId/profile)
 */
export function requireOwnerOrAdmin(resourceUserIdField = 'userId') {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // SECURITY: Only use URL params, never body - body can be manipulated
    const resourceUserId = req.params[resourceUserIdField]

    if (!resourceUserId) {
      // If no userId in params, this middleware was used incorrectly
      logger.error(`requireOwnerOrAdmin: Missing ${resourceUserIdField} in URL params`)
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const isOwner = resourceUserId === req.session.user.id
    const isAdmin = req.session.user.role === 'admin'

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' })
    }
    next()
  }
}

export default { requireAuth, requireAdmin, requireOwnerOrAdmin }
