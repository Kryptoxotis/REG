// API to manage IP whitelist
// Note: Changes require redeployment to take effect

// Current whitelisted IPs (sync with check-ip.js)
const WHITELISTED_IPS = [
  '100.120.223.96',
]

export default function handler(req, res) {
  // Get client IP
  const forwarded = req.headers['x-forwarded-for']
  const clientIP = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown'

  if (req.method === 'GET') {
    return res.status(200).json({
      whitelistedIPs: WHITELISTED_IPS,
      yourIP: clientIP,
      isWhitelisted: WHITELISTED_IPS.includes(clientIP)
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
