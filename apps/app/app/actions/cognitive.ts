"use server"

import { PrismaClient } from "@prisma/client"

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

const AI_BACKEND = process.env.AI_BACKEND_URL || "http://localhost:8000"
const AI_TOKEN = process.env.AI_BACKEND_TOKEN || ""

export interface ConceptRecord {
    concept: string
    mastery_score: number       // 0-1
    total_attempts: number
    correct_attempts: number
    confidence_weight: number
}

export interface CognitiveProfile {
    // mastery
    concepts: ConceptRecord[]
    weak_concepts: string[]
    strong_concepts: string[]
    overall_progress: number    // 0-1

    // derived stats
    exam_readiness: number      // 0-100
    volatility: number          // 0-100
    cognitive_load: number      // 0-100
    recall: number              // 0-100
    reasoning: number           // 0-100
    speed: number               // 0-100
    accuracy: number            // 0-100

    // user gamification (from DB)
    total_xp: number
    reputation: number
    current_streak: number
    longest_streak: number
    trust_score: number
    doc_count: number
}

export async function getCognitiveProfile(userId: string): Promise<{
    success: boolean
    data?: CognitiveProfile
    error?: string
}> {
    try {
        // ── 1. Mastery profile from Python backend ──
        let concepts: ConceptRecord[] = []
        let weak_concepts: string[] = []
        let strong_concepts: string[] = []
        let overall_progress = 0

        try {
            const res = await fetch(`${AI_BACKEND}/api/mastery/profile/${userId}`, {
                headers: { Authorization: `Bearer ${AI_TOKEN}` },
                cache: "no-store",
            })
            if (res.ok) {
                const json = await res.json()
                concepts = json.concepts || []
                weak_concepts = json.weak_concepts || []
                strong_concepts = json.strong_concepts || []
                overall_progress = json.overall_progress || 0
            }
        } catch {
            // Backend not reachable - use empty data
        }

        // ── 2. User stats from Postgres ──
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                totalXP: true,
                reputation: true,
                trustScoreCache: true,
                documentCount: true,
                streaks: {
                    select: {
                        currentStreak: true,
                        longestStreak: true,
                    },
                },
            },
        })

        const total_xp = user?.totalXP ?? 0
        const reputation = user?.reputation ?? 0
        const trust_score = user?.trustScoreCache ?? 0.5
        const doc_count = user?.documentCount ?? 0
        const current_streak = user?.streaks?.currentStreak ?? 0
        const longest_streak = user?.streaks?.longestStreak ?? 0

        // ── 3. Derive cognitive metrics ──
        const total = concepts.length
        const exam_readiness = total > 0
            ? Math.round(overall_progress * 100)
            : 0

        const weak_ratio = total > 0 ? weak_concepts.length / total : 0
        const volatility = Math.round(weak_ratio * 100)

        // cognitive_load: based on concepts with low confidence weight
        const low_conf = concepts.filter(c => c.confidence_weight < 0.7).length
        const cognitive_load = total > 0 ? Math.round((low_conf / total) * 100) : 0

        // Recall = strong ratio
        const recall = total > 0 ? Math.round((strong_concepts.length / total) * 100) : 0

        // Reasoning = (~weak inverse, but floor at 20 if any data)
        const reasoning = total > 0 ? Math.max(20, Math.round((1 - weak_ratio) * 100)) : 0

        // Speed = avg confidence_weight * 100
        const avg_conf = total > 0
            ? concepts.reduce((s, c) => s + c.confidence_weight, 0) / total
            : 0
        const speed = Math.round(avg_conf * 100)

        // Accuracy = overall correct ratio
        const total_attempts = concepts.reduce((s, c) => s + c.total_attempts, 0)
        const correct_attempts = concepts.reduce((s, c) => s + c.correct_attempts, 0)
        const accuracy = total_attempts > 0
            ? Math.round((correct_attempts / total_attempts) * 100)
            : 0

        return {
            success: true,
            data: {
                concepts,
                weak_concepts,
                strong_concepts,
                overall_progress,
                exam_readiness,
                volatility,
                cognitive_load,
                recall,
                reasoning,
                speed,
                accuracy,
                total_xp,
                reputation,
                current_streak,
                longest_streak,
                trust_score,
                doc_count,
            },
        }
    } catch (error) {
        console.error("getCognitiveProfile error:", error)
        return { success: false, error: "Failed to fetch cognitive profile" }
    }
}
