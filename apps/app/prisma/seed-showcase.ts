/**
 * Showcase data for demos: a populated leaderboard, mentors with requests, upcoming happenings with
 * RSVPs, more communities, and extra Q&A. Builds on seed-demo.ts and is idempotent (upsert by email /
 * slug / name / title), so it is safe to re-run.
 *
 *   DATABASE_URL=... npx tsx prisma/seed-showcase.ts
 */
import { PrismaClient, AchievementType, AchievementRarity } from "@prisma/client"
import { seedDemo } from "./seed-demo"

const prisma = new PrismaClient()
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000)
const daysFromNow = (d: number, hour = 17) => {
  const t = new Date()
  t.setDate(t.getDate() + d)
  t.setHours(hour, 0, 0, 0)
  return t
}

// name, university, course, year, xp, streak, tier, role
const PEOPLE: [string, string, string, number, number, number, string, "STUDENT" | "TEACHER"][] = [
  ["Aarav Mehta", "IIT Bombay", "B.Tech Computer Science", 3, 9420, 41, "SAGE", "STUDENT"],
  ["Sofia Alvarez", "UNAM", "B.Sc. Physics", 4, 8710, 33, "SAGE", "STUDENT"],
  ["Liam O'Connor", "Trinity College Dublin", "M.Sc. Mathematics", 1, 7985, 27, "LUMINARY", "STUDENT"],
  ["Yuki Tanaka", "University of Tokyo", "B.Eng. Robotics", 3, 7340, 19, "LUMINARY", "STUDENT"],
  ["Amara Okafor", "University of Lagos", "B.Sc. Biochemistry", 2, 6120, 22, "LUMINARY", "STUDENT"],
  ["Noah Fischer", "TU Munich", "B.Sc. Informatics", 2, 5560, 12, "AUTHORITY", "STUDENT"],
  ["Hana Kim", "KAIST", "B.Sc. Electrical Engineering", 4, 5105, 15, "AUTHORITY", "STUDENT"],
  ["Mateo Silva", "USP", "B.Sc. Chemistry", 3, 4620, 9, "AUTHORITY", "STUDENT"],
  ["Ines Dubois", "Sorbonne", "B.A. Psychology", 2, 3980, 18, "AUTHORITY", "STUDENT"],
  ["Rahul Verma", "IIIT Hyderabad", "B.Tech AI", 3, 3555, 7, "CONTRIBUTOR", "STUDENT"],
  ["Chloe Bennett", "University of Melbourne", "B.Sc. Statistics", 2, 3110, 11, "CONTRIBUTOR", "STUDENT"],
  ["Omar Haddad", "AUC Cairo", "B.Sc. Mechanical Engineering", 3, 2740, 5, "CONTRIBUTOR", "STUDENT"],
  ["Mei Lin", "NUS", "B.Comp. Computer Science", 1, 2290, 14, "CONTRIBUTOR", "STUDENT"],
  ["Lucas Moreau", "EPFL", "B.Sc. Physics", 2, 1880, 3, "CONTRIBUTOR", "STUDENT"],
  ["Zara Khan", "LUMS", "B.Sc. Economics", 2, 1420, 6, "INITIATE", "STUDENT"],
  ["Tomas Novak", "Charles University", "B.Sc. Biology", 1, 960, 2, "INITIATE", "STUDENT"],
  ["Dr. Meera Iyer", "IISc Bangalore", "Faculty, Computer Science", 9, 12400, 60, "SAGE", "TEACHER"],
  ["Prof. David Chen", "MIT", "Faculty, Mathematics", 9, 11850, 48, "SAGE", "TEACHER"],
  ["Dr. Fatima Al-Sayed", "American University of Beirut", "Faculty, Chemistry", 9, 9020, 36, "SAGE", "TEACHER"],
  ["Dr. Jonas Lindqvist", "KTH", "Faculty, Physics", 9, 8200, 29, "LUMINARY", "TEACHER"],
  ["Dr. Priyanka Rao", "IIT Madras", "Faculty, Data Science", 9, 7600, 31, "LUMINARY", "TEACHER"],
  ["Dr. Elias Berg", "ETH Zurich", "Faculty, Engineering", 9, 6900, 20, "LUMINARY", "TEACHER"],
]

const MENTORS: Record<string, { headline: string; bio: string; subjects: string[]; expertise: string[]; availability: string }> = {
  "Dr. Meera Iyer": {
    headline: "Algorithms and systems, taught from first principles",
    bio: "Fifteen years teaching data structures. I make you derive the algorithm yourself, then we make it fast.",
    subjects: ["COMPUTER_SCIENCE"],
    expertise: ["algorithms", "distributed systems", "competitive programming"],
    availability: "Tue/Thu 18:00-20:00 IST",
  },
  "Prof. David Chen": {
    headline: "Linear algebra and proofs without the fear",
    bio: "I help students move from calculating to understanding. Proof-writing clinics every week.",
    subjects: ["MATHEMATICS"],
    expertise: ["linear algebra", "real analysis", "proof writing"],
    availability: "Weekends 10:00-13:00 EST",
  },
  "Dr. Fatima Al-Sayed": {
    headline: "Organic chemistry mechanisms that finally click",
    bio: "Stop memorising reactions. Learn the six moves of electron pushing and derive the rest.",
    subjects: ["CHEMISTRY", "BIOLOGY"],
    expertise: ["organic chemistry", "spectroscopy", "biochemistry"],
    availability: "Mon/Wed evenings",
  },
  "Dr. Jonas Lindqvist": {
    headline: "Physics intuition: from mechanics to quantum",
    bio: "Dimensional analysis first, calculus second. Exam prep and research-level questions both welcome.",
    subjects: ["PHYSICS"],
    expertise: ["classical mechanics", "quantum mechanics", "electromagnetism"],
    availability: "Fridays 16:00-19:00 CET",
  },
  "Dr. Priyanka Rao": {
    headline: "Machine learning for people who want to ship",
    bio: "From linear regression to transformers, with projects. Portfolio and interview coaching included.",
    subjects: ["COMPUTER_SCIENCE", "MATHEMATICS"],
    expertise: ["machine learning", "statistics", "python", "mlops"],
    availability: "Daily 07:00-09:00 IST",
  },
  "Dr. Elias Berg": {
    headline: "Engineering design reviews and thesis guidance",
    bio: "Ex-industry. I review designs like a staff engineer and help you scope a thesis you can finish.",
    subjects: ["ENGINEERING"],
    expertise: ["control systems", "embedded", "thesis planning"],
    availability: "Wed 14:00-18:00 CET",
  },
  "Hana Kim": {
    headline: "Senior student: circuits survival guide",
    bio: "TA for two years. I know exactly where first-years get stuck in circuit analysis.",
    subjects: ["ENGINEERING", "PHYSICS"],
    expertise: ["circuit analysis", "signals", "matlab"],
    availability: "Evenings KST",
  },
  "Aarav Mehta": {
    headline: "Cracking technical interviews, one pattern at a time",
    bio: "Placed at three top firms. I teach the 12 patterns behind 90% of interview problems.",
    subjects: ["COMPUTER_SCIENCE"],
    expertise: ["interviews", "dynamic programming", "system design"],
    availability: "Weekdays 20:00-22:00 IST",
  },
}

const EVENTS: [string, string, "WORKSHOP" | "CONFERENCE" | "MEETUP" | "HACKATHON" | "SEMINAR", string, number, number | null, string[], string][] = [
  ["Entropy Hack Night: Build a Study Tool in 6 Hours", "Teams of up to four build anything that helps students learn. Mentors on call, pizza provided, demos at midnight.", "HACKATHON", "Innovation Lab, Block C", 3, 120, ["hackathon", "web", "ai"], "Aarav Mehta"],
  ["Linear Algebra in Machine Learning: Live Workshop", "SVD, PCA and embeddings, derived on a whiteboard and then implemented in NumPy. Bring a laptop.", "WORKSHOP", "Online (Zoom)", 5, 300, ["math", "ml", "numpy"], "Prof. David Chen"],
  ["Quantum Mechanics Without the Fear", "A two-hour seminar on the postulates, using only high-school algebra and a lot of pictures.", "SEMINAR", "Physics Auditorium", 7, 150, ["physics", "quantum"], "Dr. Jonas Lindqvist"],
  ["Research Methods Conference 2026", "Two days of talks on reproducibility, preprints and writing your first paper. Poster session on day two.", "CONFERENCE", "City Convention Centre", 12, 500, ["research", "writing"], "Dr. Meera Iyer"],
  ["Interview Prep Sprint: DP and Graphs", "Solve eight problems live in pairs with feedback from people who have sat on the other side of the table.", "WORKSHOP", "Library Room 204", 2, 40, ["interviews", "algorithms"], "Aarav Mehta"],
  ["Organic Chemistry Mechanisms Bootcamp", "Arrow pushing, from SN1 to aldol. Exam-style problems with worked solutions.", "WORKSHOP", "Chemistry Lab Seminar Room", 9, 60, ["chemistry", "exams"], "Dr. Fatima Al-Sayed"],
  ["Women in STEM Coffee Meetup", "Casual conversation, mentorship matching and a lot of coffee. Everyone is welcome.", "MEETUP", "Campus Cafe", 4, 80, ["community", "mentorship"], "Sofia Alvarez"],
  ["Robotics Showcase and Demo Day", "Student teams demo autonomous robots. Judges from industry; the crowd picks a favourite.", "CONFERENCE", "Engineering Atrium", 15, 400, ["robotics", "engineering"], "Yuki Tanaka"],
  ["Open Source Contribution Day", "Pick a beginner-friendly issue, get a mentor, and open your first pull request before lunch.", "MEETUP", "CS Department Commons", 6, 100, ["opensource", "git"], "Noah Fischer"],
  ["MLOps From Notebook to Production", "Deploy a model behind an API, monitor drift, and roll back safely. Hands-on with free-tier tools.", "WORKSHOP", "Online (Zoom)", 10, 250, ["ml", "devops"], "Dr. Priyanka Rao"],
  ["Thesis Writing Clinic", "Bring a draft chapter. Faculty and senior students give structured feedback in small groups.", "SEMINAR", "Humanities Hall 3", 8, 50, ["thesis", "writing"], "Dr. Elias Berg"],
  ["Last Month: Intro to Competitive Programming", "Recording available. A beginner's tour of contest problems and strategy.", "SEMINAR", "Online (Zoom)", -12, 200, ["algorithms", "contests"], "Dr. Meera Iyer"],
]

const COMMUNITIES: [string, string, string, string, string[], string][] = [
  ["machine-learning", "Machine Learning", "COMPUTER_SCIENCE", "Papers, projects and honest discussion of what works. From linear models to LLMs.", ["Cite your sources", "Share code, not screenshots", "No hype without evidence"], "Dr. Priyanka Rao"],
  ["physics-lounge", "Physics Lounge", "PHYSICS", "Mechanics to cosmology. Ask the dumb question; it is usually the deep one.", ["Show your reasoning", "Units matter", "Be curious, not condescending"], "Dr. Jonas Lindqvist"],
  ["chemistry-help", "Chemistry Help Desk", "CHEMISTRY", "Mechanisms, stoichiometry and lab technique, with patient explanations.", ["Draw the structures", "No lab-safety shortcuts", "Be patient"], "Dr. Fatima Al-Sayed"],
  ["math-circle", "Math Circle", "MATHEMATICS", "Proofs, puzzles and problem sets. Hints first, solutions later.", ["Hints before spoilers", "Prove it or flag it", "Respect every level"], "Prof. David Chen"],
  ["career-and-interviews", "Careers and Interviews", "OTHER", "Resumes, referrals, offers and how to choose between them.", ["No company-confidential info", "Be specific", "Pay it forward"], "Aarav Mehta"],
  ["biology-bench", "Biology Bench", "BIOLOGY", "Cell biology to ecology, plus lab-report and statistics help.", ["Cite primary sources", "Respect research ethics", "Be kind"], "Amara Okafor"],
]

const QUESTIONS: [string, string, string, string[], string, string, number][] = [
  ["What is the intuition behind the bias-variance tradeoff?", "I can write the decomposition but I do not feel why a more flexible model has higher variance. Is there a picture that makes it click?", "COMPUTER_SCIENCE", ["machine-learning", "statistics"], "Rahul Verma", "Dr. Priyanka Rao", 30],
  ["Why does the dot product measure similarity?", "Everyone says cosine similarity compares embeddings. Why does multiplying and adding give a notion of angle?", "MATHEMATICS", ["linear-algebra", "embeddings"], "Mei Lin", "Prof. David Chen", 55],
  ["How do I know when to use DP versus greedy?", "I keep guessing wrong. Is there a checklist for spotting overlapping subproblems and optimal substructure?", "COMPUTER_SCIENCE", ["dynamic-programming", "greedy"], "Zara Khan", "Aarav Mehta", 20],
  ["Why is the SN2 reaction inverted at the carbon?", "My textbook says backside attack gives inversion. What physically forces the nucleophile to come from the back?", "CHEMISTRY", ["organic", "mechanisms"], "Mateo Silva", "Dr. Fatima Al-Sayed", 70],
  ["Can someone explain Lagrangian mechanics simply?", "We started the Lagrangian formulation and I do not see what problem it solves that F=ma did not.", "PHYSICS", ["mechanics", "lagrangian"], "Lucas Moreau", "Dr. Jonas Lindqvist", 90],
  ["How should I structure a literature review?", "I have 40 papers and no idea how to organise them into a coherent story. Thematic, chronological, or methodological?", "OTHER", ["research", "writing"], "Tomas Novak", "Dr. Elias Berg", 14],
  ["What does it mean for a model to be calibrated?", "My classifier has 92% accuracy but its probabilities seem off. How do I check and fix calibration?", "COMPUTER_SCIENCE", ["machine-learning", "evaluation"], "Chloe Bennett", "Dr. Priyanka Rao", 44],
  ["Is it normal to feel lost in the first year of engineering?", "Everyone seems to understand circuits except me. How did you get through the confusing stretch?", "ENGINEERING", ["study-tips", "first-year"], "Omar Haddad", "Hana Kim", 8],
  ["How do enzymes lower activation energy?", "I get that they speed reactions up, but what is physically happening in the active site?", "BIOLOGY", ["biochemistry", "enzymes"], "Ines Dubois", "Amara Okafor", 62],
  ["What is the difference between a process and a thread?", "I keep mixing them up on exams. What does each one share and what does it own?", "COMPUTER_SCIENCE", ["operating-systems"], "Noah Fischer", "Dr. Meera Iyer", 36],
]

async function main() {
  console.log("Base demo content (users, communities, posts, Q&A)...")
  await seedDemo(prisma)

  console.log("Achievements...")
  const achievementDefs: [AchievementType, string, string, number, AchievementRarity][] = [
    [AchievementType.FIRST_DOUBT, "Curious Minds", "Ask your first ever doubt on Entropy.", 50, AchievementRarity.COMMON],
    [AchievementType.PROBLEM_SOLVER, "The Catalyst", "Resolve 10 doubts for your peers.", 200, AchievementRarity.UNCOMMON],
    [AchievementType.STREAK_MASTER, "Focused Mind", "Maintain a 14-day study streak.", 500, AchievementRarity.RARE],
    [AchievementType.STREAK_MASTER, "Scholar's Oath", "Maintain a 30-day streak.", 1000, AchievementRarity.EPIC],
    [AchievementType.MENTOR, "Academic Pilar", "Have 10 answers marked canonical.", 1000, AchievementRarity.LEGENDARY],
    [AchievementType.COMMUNITY_LEADER, "Town Crier", "Start a community with 20 members.", 300, AchievementRarity.RARE],
    [AchievementType.RISING_STAR, "Rising Star", "Earn 1,000 XP in your first month.", 250, AchievementRarity.UNCOMMON],
  ]
  const achievements = []
  for (const [type, name, description, points, rarity] of achievementDefs) {
    achievements.push(
      await prisma.achievement.upsert({
        where: { name },
        update: { description, points, rarity },
        create: { type, name, description, points, rarity, criteria: { count: 1 } },
      }),
    )
  }

  console.log("People, leaderboard stats, streaks...")
  const ids = new Map<string, string>()
  for (const [i, [name, university, course, year, xp, streak, tier, role]] of PEOPLE.entries()) {
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@demo.entropy.app`
    const user = await prisma.user.upsert({
      where: { email },
      update: { totalXP: xp, reputation: Math.round(xp / 6), totalReputation: Math.round(xp / 6), tier, lastActiveAt: hoursAgo(i * 5 + 1) },
      create: {
        email, name, role, university, course, year,
        totalXP: xp, reputation: Math.round(xp / 6), totalReputation: Math.round(xp / 6), tier,
        credits: 100 + Math.round(xp / 20),
        bio: role === "TEACHER" ? `${course} at ${university}. Here to help.` : `Studying ${course} at ${university}.`,
        image: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}`,
        lastActiveAt: hoursAgo(i * 5 + 1),
        createdAt: hoursAgo(24 * (200 - i * 6)),
      },
    })
    ids.set(name, user.id)
    await prisma.streak.upsert({
      where: { userId: user.id },
      update: { currentStreak: streak, longestStreak: streak + 6, lastActivityDate: hoursAgo(3) },
      create: { userId: user.id, currentStreak: streak, longestStreak: streak + 6, lastActivityDate: hoursAgo(3) },
    })
    await prisma.userStat.upsert({
      where: { userId: user.id },
      update: { totalPoints: xp },
      create: {
        userId: user.id, totalPoints: xp, currentLevel: 1 + Math.floor(xp / 1500),
        doubtsAsked: 3 + (i % 9), doubtsResolved: 2 + (i % 7), commentsPosted: 10 + i * 3,
        acceptedAnswers: Math.floor(xp / 900), upvotesReceived: Math.round(xp / 12),
      },
    })
    const unlocks = achievements.slice(0, Math.max(1, Math.min(achievements.length, Math.round(xp / 1800))))
    for (const a of unlocks) {
      await prisma.achievementUnlock.upsert({
        where: { userId_achievementId: { userId: user.id, achievementId: a.id } },
        update: {},
        create: { userId: user.id, achievementId: a.id, unlockedAt: hoursAgo(24 * (i + 2)) },
      })
    }
  }
  const id = (n: string) => ids.get(n)!

  console.log("Mentors and requests...")
  const mentorIds = new Map<string, string>()
  for (const [name, m] of Object.entries(MENTORS)) {
    const p = await prisma.mentorProfile.upsert({
      where: { userId: id(name) },
      update: { ...m, university: PEOPLE.find((x) => x[0] === name)![1] },
      create: { userId: id(name), ...m, university: PEOPLE.find((x) => x[0] === name)![1] },
    })
    mentorIds.set(name, p.id)
  }
  const REQUESTS: [string, string, string, string, "PENDING" | "ACCEPTED" | "DECLINED" | "ACCEPTED"][] = [
    ["Zara Khan", "Dr. Meera Iyer", "Graph algorithms", "I understand BFS and DFS but Dijkstra confuses me. Could we do a session before my exam?", "ACCEPTED"],
    ["Tomas Novak", "Dr. Fatima Al-Sayed", "Stereochemistry", "R/S assignment keeps tripping me up.", "PENDING"],
    ["Omar Haddad", "Hana Kim", "Circuit analysis", "Thevenin and Norton equivalents, with practice problems.", "ACCEPTED"],
    ["Lucas Moreau", "Dr. Jonas Lindqvist", "Quantum mechanics", "Help with the harmonic oscillator and ladder operators.", "ACCEPTED"],
    ["Mei Lin", "Dr. Priyanka Rao", "Career in ML", "I would like feedback on my portfolio and a study plan.", "PENDING"],
    ["Chloe Bennett", "Prof. David Chen", "Real analysis", "Epsilon-delta proofs are my nemesis.", "ACCEPTED"],
    ["Rahul Verma", "Aarav Mehta", "System design interviews", "Mock interview and feedback, please.", "PENDING"],
    ["Ines Dubois", "Dr. Elias Berg", "Thesis scoping", "How do I narrow a broad topic?", "DECLINED"],
  ]
  for (const [student, mentor, topic, message, status] of REQUESTS) {
    const exists = await prisma.mentorshipRequest.findFirst({ where: { studentId: id(student), mentorId: mentorIds.get(mentor)!, topic } })
    if (exists) continue
    await prisma.mentorshipRequest.create({
      data: {
        studentId: id(student), mentorId: mentorIds.get(mentor)!, topic, message, status,
        preferredTime: "Evenings this week",
        mentorNote: status === "ACCEPTED" ? "Happy to help. Booking a slot now." : status === "DECLINED" ? "Full this month; try the thesis clinic event." : null,
      },
    })
  }

  console.log("Happenings and RSVPs...")
  const everyone = [...ids.keys()]
  for (const [i, [title, description, category, location, inDays, capacity, tags, host]] of EVENTS.entries()) {
    let ev = await prisma.campusEvent.findFirst({ where: { title } })
    if (!ev) {
      const startsAt = daysFromNow(inDays, 10 + (i % 8))
      ev = await prisma.campusEvent.create({
        data: {
          title, description, category, location, capacity, tags, createdById: id(host),
          startsAt, endsAt: new Date(startsAt.getTime() + 3 * 3600_000),
        },
      })
    }
    const n = 6 + ((i * 5) % 14)
    for (let k = 0; k < Math.min(n, everyone.length); k++) {
      const userId = id(everyone[(i + k * 2) % everyone.length])
      await prisma.eventRsvp.upsert({
        where: { eventId_userId: { eventId: ev.id, userId } },
        update: {},
        create: { eventId: ev.id, userId },
      })
    }
  }

  console.log("Communities and posts...")
  for (const [slug, name, subject, description, rules, owner] of COMMUNITIES) {
    const c = await prisma.community.upsert({
      where: { slug },
      update: { description, rules },
      create: { slug, name, description, rules, subject: subject as never, createdBy: id(owner) },
    })
    for (const [j, person] of everyone.entries()) {
      if ((j + slug.length) % 3 === 0 || person === owner) {
        await prisma.communityMember.upsert({
          where: { userId_communityId: { userId: id(person), communityId: c.id } },
          update: {},
          create: { userId: id(person), communityId: c.id, role: person === owner ? "ADMIN" : "MEMBER" },
        })
      }
    }
    if ((await prisma.post.count({ where: { communityId: c.id } })) > 0) continue
    const post = await prisma.post.create({
      data: {
        communityId: c.id, authorId: id(owner), title: `Welcome to ${name}`, isPinned: true, score: 24, commentCount: 2, createdAt: hoursAgo(96),
        body: `${description}\n\n**Ground rules**\n${rules.map((r) => `- ${r}`).join("\n")}\n\nIntroduce yourself below and tell us what you are working on.`,
      },
    })
    const first = await prisma.comment.create({
      data: { postId: post.id, authorId: id(everyone[(slug.length * 3) % everyone.length]), body: "Glad this exists. Currently working through problem sets and could use a study group.", score: 6, createdAt: hoursAgo(80) },
    })
    await prisma.comment.create({
      data: { postId: post.id, authorId: id(owner), parentId: first.id, body: "Post in the main feed and tag it. People here love a good study group.", score: 4, createdAt: hoursAgo(70) },
    })
  }

  console.log("Questions and answers...")
  for (const [i, [title, content, subject, tags, asker, answerer, ago]] of QUESTIONS.entries()) {
    if (await prisma.doubt.findFirst({ where: { title }, select: { id: true } })) continue
    const doubt = await prisma.doubt.create({
      data: {
        title, content, subject, tags, authorId: id(asker), isResolved: i % 3 !== 2,
        upvotes: 8 + i * 3, views: 120 + i * 45, createdAt: hoursAgo(ago),
      },
    })
    await prisma.answer.create({
      data: {
        doubtId: doubt.id, authorId: id(answerer), isAccepted: i % 3 !== 2, upvotes: 12 + i * 2, createdAt: hoursAgo(Math.max(ago - 3, 1)),
        content: "Short version: start from the definition, then build a picture you can sketch in ten seconds.\n\n1. Write down what you already know for a tiny example.\n2. Generalise one step at a time and check each step against the example.\n3. If it still feels magical, you skipped a step. Ask me which one and I will walk through it.\n\nHappy to go deeper in a mentoring session.",
      },
    })
  }

  const counts = {
    users: await prisma.user.count(),
    doubts: await prisma.doubt.count(),
    answers: await prisma.answer.count(),
    communities: await prisma.community.count(),
    posts: await prisma.post.count(),
    mentors: await prisma.mentorProfile.count(),
    requests: await prisma.mentorshipRequest.count(),
    events: await prisma.campusEvent.count(),
    rsvps: await prisma.eventRsvp.count(),
    achievements: await prisma.achievement.count(),
  }
  console.log("Done:", counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
