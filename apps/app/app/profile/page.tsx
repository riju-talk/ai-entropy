import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"

// /profile is just "my profile": send signed-in users to their public profile URL.
export default async function MyProfileRedirect() {
  const session = await getServerSession(authOptions)
  const id = (session?.user as { id?: string } | undefined)?.id
  if (!id) redirect("/auth/signin?callbackUrl=/profile")
  redirect(`/profile/${id}`)
}
