export interface Doubt {
  id: string
  title: string
  content: string
  subject: string
  tags: string[]
  isAnonymous: boolean
  authorId: string
  createdAt: Date
  updatedAt: Date
  author?: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  _count?: {
    answers: number
  }
}
