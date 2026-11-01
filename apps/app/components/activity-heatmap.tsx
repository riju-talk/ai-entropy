"use client"

import { cn } from "@/lib/utils"

interface Day {
  date: string
  count: number
}

const LEVELS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
] as const

function level(count: number, max: number) {
  if (count <= 0) return 0
  if (max <= 1) return 4
  const ratio = count / max
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

/**
 * Contribution calendar: one column per week, one square per day (oldest left, newest right).
 * Counts combine questions, answers, study sessions and event sign-ups.
 */
export function ActivityHeatmap({ days }: { days: Day[] }) {
  if (days.length === 0) return null
  const max = Math.max(...days.map((d) => d.count))

  // Pad the front so the first column starts on a Sunday.
  const firstDow = new Date(`${days[0].date}T00:00:00Z`).getUTCDay()
  const cells: (Day | null)[] = [...Array(firstDow).fill(null), ...days]
  const weeks: (Day | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max gap-[3px]" role="img" aria-label="Activity over the last 26 weeks">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((d, di) =>
                d ? (
                  <div
                    key={d.date}
                    title={`${d.count} ${d.count === 1 ? "contribution" : "contributions"} on ${d.date}`}
                    className={cn("h-[11px] w-[11px] rounded-[2px]", LEVELS[level(d.count, max)])}
                  />
                ) : (
                  <div key={`pad-${di}`} className="h-[11px] w-[11px]" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        <span>Less</span>
        {LEVELS.map((l) => (
          <span key={l} className={cn("h-[11px] w-[11px] rounded-[2px]", l)} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
