import { handleCors, sanitizeEmail, findUserByEmail, checkRateLimit } from '../../config/utils.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limiting
  const rateLimit = await checkRateLimit(req)
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const user = await findUserByEmail(sanitizeEmail(email))
    
    if (!user) {
      return res.json({
        status: 'not_found',
        message: 'Please contact admin to create an account'
      })
    }
    
    const status = user.status?.toLowerCase() || 'unknown'
    
    if (status === 'active') {
      return res.json({
        status: 'active',
        message: 'Please enter your password',
        hasPassword: !!user.password
      })
    }
    
    if (status === 'pending') {
      return res.json({
        status: 'pending',
        message: 'Please create a password to activate your account'
      })
    }
    
    if (status === 'terminated') {
      return res.json({
        status: 'terminated',
        message: 'You do not have access. Please contact admin.'
      })
    }
    
    return res.json({
      status: 'unknown',
      message: 'Account status unknown. Please contact admin.'
    })
    
  } catch (error) {
    console.error('Check email error:', error.message)
    res.status(500).json({ error: 'Failed to check email' })
  }
}
