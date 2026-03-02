"use client"

import { Globe } from "lucide-react"
import { useI18n } from "./i18n-provider"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale("en")}>{t("lang.english")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("hi")}>{t("lang.hindi")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
