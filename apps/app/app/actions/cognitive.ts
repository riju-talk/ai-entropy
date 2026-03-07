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
        // ── 1. Cognitive stats from Python backend (single call) ──
        let concepts: ConceptRecord[] = []
        let weak_concepts: string[] = []
        let strong_concepts: string[] = []
        let overall_progress = 0
        let exam_readiness = 0
        let volatility = 0
        let cognitive_load = 0
        let recall = 0
        let reasoning = 0
        let speed = 0
        let accuracy = 0

        try {
            const [statsRes, profileRes] = await Promise.all([
                fetch(`${AI_BACKEND}/api/mastery/cognitive-stats/${userId}`, {
                    headers: { Authorization: `Bearer ${AI_TOKEN}` },
                    cache: "no-store",
                }),
                fetch(`${AI_BACKEND}/api/mastery/profile/${userId}`, {
                    headers: { Authorization: `Bearer ${AI_TOKEN}` },
                    cache: "no-store",
                }),
            ])

            if (profileRes.ok) {
                const json = await profileRes.json()
                concepts = json.concepts || []
                weak_concepts = json.weak_concepts || []
                strong_concepts = json.strong_concepts || []
                overall_progress = json.overall_progress || 0
            }

            if (statsRes.ok) {
                const stats = await statsRes.json()
                exam_readiness = stats.exam_readiness ?? 0
                volatility = stats.volatility ?? 0
                cognitive_load = stats.cognitive_load ?? 0
                recall = stats.recall ?? 0
                reasoning = stats.reasoning ?? 0
                speed = stats.speed ?? 0
                accuracy = stats.accuracy ?? 0
            } else {
                // Derive locally if stats endpoint not yet deployed
                const total = concepts.length
                const weak_ratio = total > 0 ? weak_concepts.length / total : 0
                exam_readiness = Math.round(overall_progress * 100)
                volatility = Math.round(weak_ratio * 100)
                const low_conf = concepts.filter(c => c.confidence_weight < 0.7).length
                cognitive_load = total > 0 ? Math.round((low_conf / total) * 100) : 0
                recall = total > 0 ? Math.round((strong_concepts.length / total) * 100) : 0
                reasoning = total > 0 ? Math.max(20, Math.round((1 - weak_ratio) * 100)) : 0
                const avg_conf = total > 0 ? concepts.reduce((s, c) => s + c.confidence_weight, 0) / total : 0
                speed = Math.round(avg_conf * 100)
                const total_attempts = concepts.reduce((s, c) => s + c.total_attempts, 0)
                const correct_attempts = concepts.reduce((s, c) => s + c.correct_attempts, 0)
                accuracy = total_attempts > 0 ? Math.round((correct_attempts / total_attempts) * 100) : 0
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
