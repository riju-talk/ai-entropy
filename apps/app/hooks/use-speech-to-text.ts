"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type RecognitionStatic = typeof window extends any
  ? (window & { webkitSpeechRecognition?: any; SpeechRecognition?: any })["SpeechRecognition"]
  : any

export function useSpeechToText(opts?: { lang?: string; interimResults?: boolean; continuous?: boolean }) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      setSupported(true)
      const rec = new SR() as RecognitionStatic
      rec.lang = opts?.lang || "en-US"
      rec.interimResults = opts?.interimResults ?? true
      rec.continuous = opts?.continuous ?? false
      recognitionRef.current = rec
    }
  }, [opts?.lang, opts?.interimResults, opts?.continuous])

  const start = useCallback((onResult?: (finalTranscript: string, isFinal: boolean) => void) => {
    if (!recognitionRef.current) return
    const rec = recognitionRef.current
    let finalBuffer = ""

    rec.onresult = (event: any) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalBuffer += transcript + " "
          onResult?.(finalBuffer.trim(), true)
        } else {
          interim += transcript
          onResult?.((finalBuffer + " " + interim).trim(), false)
        }
      }
    }

    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)

    try {
      rec.start()
      setListening(true)
    } catch (_e) {
      // swallow double-start errors
    }
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop?.()
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}
