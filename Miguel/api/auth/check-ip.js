// Vercel Serverless Function for IP-based auto-login
// Add trusted IP addresses to this list
const WHITELISTED_IPS = [
  '100.120.223.96',
]

export default function handler(req, res) {
  // Get client IP from various headers (Vercel uses x-forwarded-for)
  const forwarded = req.headers['x-forwarded-for']
  const clientIP = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown'

  console.log('Check IP request from:', clientIP)

  // Check if IP is whitelisted
  const isWhitelisted = WHITELISTED_IPS.some(ip => clientIP === ip || clientIP.startsWith(ip))

  if (isWhitelisted) {
    return res.status(200).json({
      authorized: true,
      user: {
        id: 'auto-auth-1',
        email: 'auto@reg.com',
        role: 'admin',
        fullName: 'Auto Login User'
      },
      ip: clientIP
    })
  }

  return res.status(200).json({
    authorized: false,
    ip: clientIP
  })
}
