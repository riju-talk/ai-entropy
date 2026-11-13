"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

/**
 * Renders user-written Markdown. react-markdown does not render raw HTML, so pasted
 * <script> or <iframe> text stays inert. Links open in a new tab without leaking the opener.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose max-w-none text-[15px]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Only our own uploads render as images; external image URLs become plain links (no tracking pixels)
          img: ({ src, alt }) =>
            typeof src === "string" && src.startsWith("/api/uploads/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt || "Attached picture"} loading="lazy" className="my-3 max-h-[28rem] rounded border" />
            ) : typeof src === "string" ? (
              <a href={src} target="_blank" rel="noopener noreferrer nofollow">
                {alt || src}
              </a>
            ) : null,
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
