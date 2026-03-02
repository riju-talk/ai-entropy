"use server"

import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"
import exp from "constants"

// Use a singleton for Prisma in development to avoid connection exhaustion
const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export async function createDocumentRecord(data: {
    title: string
    type: string
    size: number
    userId: string
}) {
    try {
        const doc = await prisma.document.create({
            data: {
                title: data.title,
                type: data.type,
                size: data.size,
                userId: data.userId
                // pineconeId can be added later if we want strict linking
            },
        })

        // Also increment user document count
        await prisma.user.update({
            where: { id: data.userId },
            data: { documentCount: { increment: 1 } },
        })

        return { success: true, doc }
    } catch (error) {
        console.error("Error creating document record:", error)
        return { success: false, error: "Failed to create document record" }
    }
}

export async function getUserDocuments(userId: string) {
    try {
        const docs = await prisma.document.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        })
        return { success: true, docs }
    } catch (error) {
        console.error("Error fetching user documents:", error)
        return { success: false, docs: [] }
    }
}

export async function checkDocumentLimit(userId: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { documentCount: true, subscriptionTier: true }
        })

        if (!user) return { allowed: false, reason: "User not found" }

        // Beta limit: 10
        const limit = user.subscriptionTier === "FREE" ? 10 : 1000
        if (user.documentCount >= limit) {
            return { allowed: false, reason: "Limit reached", limit, current: user.documentCount }
        }

        return { allowed: true, limit, current: user.documentCount }
    } catch (error) {
        return { allowed: false, error: "Error checking limit" }
    }
}
