import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"

let __prisma__: PrismaClient | undefined
function getPrisma() {
	if (!__prisma__) {
		__prisma__ = new PrismaClient({ log: ["error", "warn"] })
	}
	return __prisma__
}

export const dynamic = "force-dynamic"

export async function GET() {
	try {
		const session = await getServerSession(authOptions)

		if (!session?.user?.email) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const user = await getPrisma().user.findUnique({
			where: { email: session.user.email },
			select: { id: true },
		})

		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 })
		}

		// Fetch user's unlocked achievements with details
		const achievementUnlocks = await getPrisma().achievementUnlock.findMany({
			where: { userId: user.id },
			include: {
				achievement: {
					select: {
						id: true,
						name: true,
						description: true,
						icon: true,
						rarity: true,
						points: true,
					},
				},
			},
			orderBy: { unlockedAt: "desc" },
		})

		// Fetch user's granted badges with details
		const badgeGrants = await getPrisma().badgeGrant.findMany({
			where: { userId: user.id },
			include: {
				badge: {
					select: {
						id: true,
						name: true,
						icon: true,
						type: true,
					},
				},
			},
			orderBy: { grantedAt: "desc" },
		})

		return NextResponse.json({
			achievements: achievementUnlocks.map((unlock) => ({
				...unlock.achievement,
				unlockedAt: unlock.unlockedAt,
			})),
			badges: badgeGrants.map((grant) => ({
				...grant.badge,
				grantedAt: grant.grantedAt,
			})),
		})
	} catch (error) {
		console.error("Error fetching user achievements:", error)
		return NextResponse.json(
			{ error: "Failed to fetch achievements" },
			{ status: 500 }
		)
	}
}
