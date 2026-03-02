import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { adminAuth } from '@/lib/firebaseAdmin'

jest.mock('@/lib/prisma')
jest.mock('@/lib/firebaseAdmin')

describe('Authentication', () => {
  it('should verify Firebase ID token and return user', async () => {
    const mockDecoded = { uid: '123', email: 'test@example.com', email_verified: true, name: 'Test User' }
    ;(adminAuth.verifyIdToken as jest.Mock).mockResolvedValue(mockDecoded)
    ;(prisma.user.upsert as jest.Mock).mockResolvedValue({ id: '1', email: 'test@example.com' })

    const credentialsProvider = authConfig.providers.find(p => p.name === 'Firebase')
    const result = await credentialsProvider.authorize({ idToken: 'valid-token' })

    expect(result).toEqual({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      image: undefined,
    })
  })

  it('should handle invalid ID token', async () => {
    const credentialsProvider = authConfig.providers.find(p => p.name === 'Firebase')
    const result = await credentialsProvider.authorize({ idToken: null })
    expect(result).toBeNull()
  })
})
