"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Construction, Clock, Sparkles } from "lucide-react"

interface WIPFeatureProps {
  title: string
  description: string
  estimatedCompletion?: string
  features?: string[]
}

export function WIPFeature({ title, description, estimatedCompletion, features }: WIPFeatureProps) {
  return (
    <Card className="border-dashed border-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Construction className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
          <Sparkles className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="ml-2">
            <strong>Work in Progress</strong>
            <p className="mt-1 text-sm text-muted-foreground">
              This feature is part of our Phase 2 roadmap. Core learning intelligence is already functional!
            </p>
            {estimatedCompletion && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Estimated completion: {estimatedCompletion}
              </p>
            )}
          </AlertDescription>
        </Alert>

        {features && features.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Planned Features:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-xs mt-0.5">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface WIPSectionProps {
  children: React.ReactNode
  className?: string
}

export function WIPSection({ children, className }: WIPSectionProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-muted/30 backdrop-blur-[1px] z-10 flex items-center justify-center">
        <div className="bg-background/90 backdrop-blur-sm p-4 rounded-lg border-2 border-dashed border-yellow-500 flex items-center gap-3">
          <Construction className="h-5 w-5 text-yellow-500" />
          <div>
            <p className="font-semibold text-sm">Feature Under Construction</p>
            <p className="text-xs text-muted-foreground">Coming in Phase 2</p>
          </div>
        </div>
      </div>
      <div className="opacity-50 pointer-events-none">{children}</div>
    </div>
  )
}
