"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { pipe, type VisionEvent } from "@screenpipe/browser"
import { createGroq } from "@ai-sdk/groq"
import { generateText } from "ai"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Languages, Play, Pause, Globe2, HelpCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// Initialize Groq client
const groq = createGroq({
  apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY,
})

interface LanguageContext {
  sourceLang: string | null
  targetLang: string | null
  platform: string | null
  mode: "translation" | "learning" | "practice" | null
}

interface Suggestion {
  id: string
  text: string
  timestamp: Date
  type: "auto" | "user-requested"
}

// Enhanced language patterns
const LANGUAGE_PATTERNS = {
  english: [
    /\b(the|a|an|is|are|was|were|have|has|had|will|would|could|should|may|might|must|can)\b/i,
    /\b(I|you|he|she|it|we|they|them|his|her|its|our|their)\b/i,
  ],
  french: [
    /\b(le|la|les|un|une|des|est|sont|était|étaient|a|ont|avait|avaient|sera|seront|pourrait|pourraient|doit|peuvent)\b/i,
    /\b(je|tu|il|elle|nous|vous|ils|elles|son|sa|ses|notre|votre|leur|leurs)\b/i,
    /\b(à|être|avoir|faire|dire|aller|voir|savoir|pouvoir|falloir|valoir)\b/i,
  ],
  // ... other languages ...
}

// Platform detection patterns
const PLATFORM_PATTERNS = {
  duolingo: /duolingo|duo|lesson|skill|crown|lingot/i,
  babbel: /babbel|lesson|course|review/i,
  rosettaStone: /rosetta\s*stone|level|unit|lesson/i,
  // Add more platforms as needed
}

function detectLanguageContext(text: string): LanguageContext {
  // Initialize context
  const context: LanguageContext = {
    sourceLang: null,
    targetLang: null,
    platform: null,
    mode: null,
  }

  // Detect platform first
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(text)) {
      context.platform = platform
      break
    }
  }

  // Look for translation indicators
  const translationPatterns = [
    /translate|translation|write.+in|say.+in/i,
    /[A-Za-z\s]+ → [A-Za-z\s]+/,
    /from [A-Za-z]+ to [A-Za-z]+/i,
  ]

  const isTranslationContext = translationPatterns.some((pattern) => pattern.test(text))

  // Detect languages
  const languageScores = Object.entries(LANGUAGE_PATTERNS)
    .map(([language, patterns]) => {
      const score = patterns.reduce((acc, pattern) => {
        const matches = text.match(pattern)
        return acc + (matches ? matches.length : 0)
      }, 0)
      return { language, score }
    })
    .sort((a, b) => b.score - a.score)

  if (languageScores.length >= 2 && languageScores[0].score > 0 && languageScores[1].score > 0) {
    // If we detect significant presence of two languages
    if (isTranslationContext) {
      context.mode = "translation"
      context.sourceLang = languageScores[1].language // Usually the source language has fewer matches
      context.targetLang = languageScores[0].language
    } else {
      context.mode = "learning"
      context.targetLang = languageScores[1].language // The language being learned usually has fewer matches
      context.sourceLang = languageScores[0].language
    }
  } else if (languageScores[0].score > 0) {
    // Single language detected
    context.mode = "practice"
    context.targetLang = languageScores[0].language
  }

  return context
}

export function LanguageTutor() {
  const [isTutorActive, setIsTutorActive] = useState(false)
  const [languageContext, setLanguageContext] = useState<LanguageContext>({
    sourceLang: null,
    targetLang: null,
    platform: null,
    mode: null,
  })
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const lastProcessedText = useRef<string>("")
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [preferredLanguage, setPreferredLanguage] = useState<string>("french")
  const suggestionsContainerRef = useRef<HTMLDivElement>(null)
  const [userQuery, setUserQuery] = useState("")
  const [lastApiCallTimestamp, setLastApiCallTimestamp] = useState(0)
  const [significantChangeDetected, setSignificantChangeDetected] = useState(false)

  const generateSuggestions = useCallback(
    async (text: string, context: LanguageContext, isUserRequested = false) => {
      if (isGenerating) return

      const now = Date.now()
      if (!isUserRequested && now - lastApiCallTimestamp < 30000) {
        console.log("Skipping API call due to rate limiting")
        return
      }

      setIsGenerating(true)
      setLastApiCallTimestamp(now)

      try {
        const prompt = `
As a language tutor, I'm helping someone who is ${context.mode === "translation" ? "translating" : "learning"} 
${context.targetLang || preferredLanguage} ${context.sourceLang ? `using ${context.sourceLang} as their base language` : ""}.
${context.platform ? `They are using ${context.platform} for learning.` : ""}

Current context: "${text}"

${isUserRequested ? `User's specific question: "${userQuery}"` : ""}

Provide ${isUserRequested ? "a detailed answer to the user's question" : "3 helpful suggestions"} focusing on:
${
  context.mode === "translation"
    ? "1. Translation accuracy and alternatives\n2. Common pitfalls and false friends\n3. Cultural context and usage tips"
    : "1. Grammar explanation or correction\n2. Vocabulary and pronunciation tips\n3. Cultural insights and usage examples"
}

Format each suggestion as a clear, concise sentence without numbering or bullet points.
`

        const { text: response } = await generateText({
          model: groq("gemma2-9b-it"),
          prompt,
          maxTokens: isUserRequested ? 300 : 200,
        })

        const parsedSuggestions = response.split("\n").filter((s) => s.trim().length > 0)
        const newSuggestions: Suggestion[] = parsedSuggestions.map((text) => ({
          id: Math.random().toString(36).substr(2, 9),
          text,
          timestamp: new Date(),
          type: isUserRequested ? "user-requested" : "auto",
        }))

        setSuggestions((prev) => [...newSuggestions, ...prev])

        if (suggestionsContainerRef.current) {
          suggestionsContainerRef.current.scrollTop = 0
        }
      } catch (error) {
        console.error("Failed to generate suggestions:", error)
      } finally {
        setIsGenerating(false)
        setSignificantChangeDetected(false)
      }
    },
    [isGenerating, lastApiCallTimestamp, preferredLanguage, userQuery],
  )

  const handleScreenDataChange = useCallback(
    (data: VisionEvent | null) => {
      if (data?.text && isTutorActive) {
        const newContext = detectLanguageContext(data.text)
        setLanguageContext(newContext)

        if (data.text !== lastProcessedText.current) {
          // Check for significant changes
          const hasSignificantChange = checkForSignificantChanges(data.text, lastProcessedText.current)

          if (hasSignificantChange) {
            setSignificantChangeDetected(true)
            if (suggestionTimeoutRef.current) {
              clearTimeout(suggestionTimeoutRef.current)
            }
            suggestionTimeoutRef.current = setTimeout(() => {
              generateSuggestions(data.text, newContext)
            }, 2000) // Increased delay to 2 seconds
          }

          lastProcessedText.current = data.text
        }
      }
    },
    [isTutorActive, generateSuggestions],
  )

  const checkForSignificantChanges = (newText: string, oldText: string): boolean => {
    // Implement logic to determine if the change is significant enough to warrant a new API call
    // This could include checking for new sentences, significant word count changes, etc.
    const wordCountDifference = Math.abs(newText.split(" ").length - oldText.split(" ").length)
    const newSentenceCount = (newText.match(/[.!?]+/g) || []).length
    const oldSentenceCount = (oldText.match(/[.!?]+/g) || []).length

    return wordCountDifference > 10 || newSentenceCount !== oldSentenceCount
  }

  const handleUserQuery = () => {
    if (userQuery.trim()) {
      generateSuggestions(lastProcessedText.current, languageContext, true)
      setUserQuery("")
    }
  }

  useEffect(() => {
    const monitorContent = async () => {
      try {
        for await (const event of pipe.streamVision(true)) {
          if (event.data) {
            handleScreenDataChange(event.data)
          }
        }
      } catch (error) {
        console.error("Failed to monitor content:", error)
      }
    }

    if (isTutorActive) {
      monitorContent()
    }

    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current)
      }
    }
  }, [isTutorActive, handleScreenDataChange])

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-2xl font-bold">Language Tutor</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select target language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="french">French</SelectItem>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="spanish">Spanish</SelectItem>
              <SelectItem value="german">German</SelectItem>
              <SelectItem value="italian">Italian</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => setIsTutorActive(!isTutorActive)}
            variant={isTutorActive ? "destructive" : "default"}
            className="w-[140px]"
          >
            {isTutorActive ? (
              <>
                <Pause className="mr-2 h-4 w-4" /> Stop Tutor
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Start Tutor
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isTutorActive && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Languages className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">
                  {languageContext.mode ? (
                    <>
                      {languageContext.mode === "translation" ? "Translation" : "Learning"} Mode:
                      {languageContext.sourceLang && ` from ${languageContext.sourceLang}`}
                      {languageContext.targetLang && ` to ${languageContext.targetLang}`}
                    </>
                  ) : (
                    "Analyzing context..."
                  )}
                </span>
              </div>
              {languageContext.platform && (
                <Badge variant="outline" className="capitalize">
                  <Globe2 className="mr-1 h-4 w-4" />
                  {languageContext.platform}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Ask for Help</h4>
              <div className="flex space-x-2">
                <Textarea
                  placeholder="Ask a specific question about your current task..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="flex-grow"
                />
                <Button onClick={handleUserQuery} disabled={isGenerating}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Ask
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Language Suggestions</h4>
              {significantChangeDetected && !isGenerating && (
                <Badge variant="outline" className="mb-2">
                  Significant change detected
                </Badge>
              )}
              <div ref={suggestionsContainerRef} className="h-64 overflow-y-auto space-y-2 pr-2">
                <AnimatePresence>
                  {suggestions.map((suggestion) => (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className={`p-3 rounded-md shadow-sm ${
                        suggestion.type === "user-requested" ? "bg-blue-50" : "bg-muted"
                      }`}
                    >
                      <p className="text-sm">{suggestion.text}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-muted-foreground">{suggestion.timestamp.toLocaleTimeString()}</p>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.type === "user-requested" ? "User Query" : "Auto"}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isGenerating && (
                  <div className="flex justify-center items-center h-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {!isTutorActive && (
          <div className="text-center py-8">
            <Languages className="h-12 w-12 text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Click &quot;Start Tutor&quot; to begin language assistance</p>
            <p className="text-sm text-muted-foreground mt-2">
              The Language Tutor will analyze your learning context and provide relevant suggestions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

