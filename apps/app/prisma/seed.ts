import { PrismaClient, AchievementType, AchievementRarity } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding core achievements...");

    const achievements = [
        {
            type: AchievementType.FIRST_DOUBT,
            name: "Curious Minds",
            description: "Ask your first ever doubt on Novyra.",
            points: 50,
            rarity: AchievementRarity.COMMON,
            criteria: { count: 1 },
        },
        {
            type: AchievementType.PROBLEM_SOLVER,
            name: "The Catalyst",
            description: "Resolve 10 doubts for your peers.",
            points: 200,
            rarity: AchievementRarity.UNCOMMON,
            criteria: { count: 10 },
        },
        {
            type: AchievementType.STREAK_MASTER,
            name: "Focused Mind",
            description: "Maintain a 14-day study streak.",
            points: 500,
            rarity: AchievementRarity.RARE,
            criteria: { days: 14 },
        },
        {
            type: AchievementType.STREAK_MASTER,
            name: "Scholar's Oath",
            description: "Maintain a 30-day streak to unlock a recurring subscription discount.",
            points: 1000,
            rarity: AchievementRarity.EPIC,
            criteria: { days: 30 },
        },
        {
            type: AchievementType.MENTOR,
            name: "Academic Pilar",
            description: "Have 10 of your answers marked as 'High Quality' or 'Canonical'.",
            points: 1000,
            rarity: AchievementRarity.LEGENDARY,
            criteria: { count: 10 },
        },
    ];

    for (const achievement of achievements) {
        await prisma.achievement.upsert({
            where: { name: achievement.name },
            update: achievement,
            create: achievement,
        });
    }

    console.log("Seeding levels...");
    // Level bands (Initiate, Contributor, Authority, Luminary, Sage)
    // These mapping names could be used in the UI based on Level Number

    console.log("Seed complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
