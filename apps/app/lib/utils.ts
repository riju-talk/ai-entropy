import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return "just now"
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}d ago`
  }

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`
  }

  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears}y ago`
}

export function getSubjectColor(subject: string): string {
  const colors: Record<string, string> = {
    COMPUTER_SCIENCE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    MATHEMATICS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    PHYSICS: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    CHEMISTRY: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    BIOLOGY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
    ENGINEERING: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    BUSINESS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    LITERATURE: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
    HISTORY: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
    PSYCHOLOGY: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
    OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  }
  return colors[subject] || colors.OTHER
}
