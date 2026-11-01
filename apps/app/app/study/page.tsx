import { StudyTimer } from "@/components/study-timer"

export const metadata = { title: "Study timer" }

export default function StudyPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <StudyTimer />
    </div>
  )
}
