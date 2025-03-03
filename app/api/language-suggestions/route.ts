import { createGroq } from "@ai-sdk/groq"
import { streamText } from "ai"

// Initialize Groq client
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { text, language } = await req.json()

    if (!text) {
      return Response.json({ error: "Text is required" }, { status: 400 })
    }

    // Log API key status (not the actual key)
    console.log(
      "API key status:",
      process.env.GROQ_API_KEY ? "Server API key set" : "Server API key missing",
      process.env.NEXT_PUBLIC_GROQ_API_KEY ? "Public API key set" : "Public API key missing",
    )

    const prompt = `
You are a language tutor assistant. I'm learning ${language || "a foreign language"}.
Here's the text from my screen:

${text}

Based on this content, please provide:
1. Any grammar corrections if you see errors
2. Alternative ways to express the same ideas
3. Vocabulary explanations for difficult words
4. A brief tip about the grammar or vocabulary being used

Keep your response concise and focused on helping me learn the language better.
`

    try {
      const result = streamText({
        model: groq("gemma2-9b-it"),
        prompt,
        maxTokens: 500,
      })

      return result.toDataStreamResponse()
    } catch (modelError) {
      console.error("Error with Groq model:", modelError)
      return Response.json(
        {
          error: `Model error: ${modelError instanceof Error ? modelError.message : "Unknown model error"}`,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error generating language suggestions:", error)
    return Response.json(
      {
        error: `Failed to generate suggestions: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}

