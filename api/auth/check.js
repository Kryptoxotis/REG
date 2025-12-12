// Vercel Serverless Function for auth check
// Note: Serverless functions are stateless, so sessions don't persist
// The frontend stores user data in React state/localStorage

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  // In serverless, we can't maintain sessions
  // Return 401 to indicate user needs to login
  // Frontend should handle this by checking localStorage
  return res.status(401).json({ error: 'Not authenticated' })
}
