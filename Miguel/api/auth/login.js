// Vercel Serverless Function for login
const ADMIN_CREDENTIALS = {
  email: 'admin@reg.com',
  password: 'admin123',
  fullName: 'Admin User',
  role: 'admin'
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
    return res.status(200).json({
      user: {
        id: 'admin-1',
        email: ADMIN_CREDENTIALS.email,
        role: ADMIN_CREDENTIALS.role,
        fullName: ADMIN_CREDENTIALS.fullName
      }
    })
  }

  return res.status(401).json({ error: 'Invalid credentials' })
}
