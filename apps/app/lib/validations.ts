import { z } from "zod"

export const createDoubtSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters").max(200, "Title must be less than 200 characters"),
  content: z.string().min(20, "Content must be at least 20 characters"),
  subject: z.enum([
    "COMPUTER_SCIENCE",
    "MATHEMATICS",
    "PHYSICS",
    "CHEMISTRY",
    "BIOLOGY",
    "ENGINEERING",
    "BUSINESS",
    "LITERATURE",
    "HISTORY",
    "PSYCHOLOGY",
    "OTHER",
  ]),
  tags: z.array(z.string()).max(5, "Maximum 5 tags allowed"),
  isAnonymous: z.boolean().default(false),
  imageUrl: z.string().url().optional().or(z.literal("")),
})

export const createCommentSchema = z.object({
  content: z.string().min(10, "Comment must be at least 10 characters"),
  doubtId: z.string().cuid(),
  parentId: z.string().cuid().optional(),
  isAnonymous: z.boolean().default(false),
})

export const voteSchema = z.object({
  type: z.enum(["UP", "DOWN"]),
  doubtId: z.string().cuid().optional(),
  commentId: z.string().cuid().optional(),
})
