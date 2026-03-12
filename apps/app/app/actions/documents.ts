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
    url?: string
    pineconeId?: string
}) {
    try {
        const doc = await prisma.document.create({
            data: {
                title: data.title,
                type: data.type,
                size: data.size,
                userId: data.userId,
                ...(data.url ? { url: data.url } : {}),
                ...(data.pineconeId ? { pineconeId: data.pineconeId } : {}),
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

export async function updateDocumentRecord(
    docId: string,
    data: { url?: string; pineconeId?: string },
) {
    try {
        await prisma.document.update({ where: { id: docId }, data })
        return { success: true }
    } catch (error) {
        console.error("Error updating document record:", error)
        return { success: false }
    }
}

export async function deleteDocument(
    docId: string,
    userId: string,
    source?: string,
    s3Key?: string,
) {
    try {
        // 1. Remove from Prisma
        await prisma.document.delete({ where: { id: docId } })

        // 2. Decrement user document count
        await prisma.user.update({
            where: { id: userId },
            data: { documentCount: { decrement: 1 } },
        })

        // 3. Clean up Pinecone vectors + S3 + knowledge graph (best-effort)
        try {
            const params = new URLSearchParams({ user_id: userId })
            if (source) params.set("source", source)
            if (s3Key)  params.set("s3_key", s3Key)
            const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
            await fetch(`${backendUrl}/api/documents/by-source?${params.toString()}`, { method: "DELETE" })
        } catch {
            // non-fatal
        }

        return { success: true }
    } catch (error) {
        console.error("Error deleting document:", error)
        return { success: false, error: "Failed to delete document" }
    }
}

export async function deleteDocuments(
    docs: Array<{ id: string; title?: string; url?: string }>,
    userId: string,
) {
    const ids = docs.map(d => d.id)

    // 1. Remove all from Prisma in one shot
    await prisma.document.deleteMany({ where: { id: { in: ids }, userId } })

    // 2. Decrement count
    await prisma.user.update({
        where: { id: userId },
        data: { documentCount: { decrement: ids.length } },
    })

    // 3. Best-effort: clean Pinecone + S3 + graph for each doc
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
    await Promise.allSettled(
        docs.map(d => {
            const params = new URLSearchParams({ user_id: userId })
            if (d.title) params.set("source", d.title)
            if (d.url)   params.set("s3_key",  d.url)
            return fetch(`${backendUrl}/api/documents/by-source?${params.toString()}`, { method: "DELETE" })
        })
    )

    return { success: true, deleted: ids.length }
}
