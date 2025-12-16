import { handleCors } from '../config/utils.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check required env vars
  const missingEnvVars = []
  if (!process.env.NOTION_API_KEY) missingEnvVars.push('NOTION_API_KEY')
  if (!process.env.TOKEN_SECRET) missingEnvVars.push('TOKEN_SECRET')

  const status = missingEnvVars.length === 0 ? 'healthy' : 'degraded'

  res.status(200).json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    ...(missingEnvVars.length > 0 && { missingEnvVars })
  })
}
