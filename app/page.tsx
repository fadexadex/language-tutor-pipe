"use client"

import { useState, useEffect } from "react"
import { HealthStatus } from "@/components/health-status"
import { LanguageTutor } from "@/components/language-tutor"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Languages, Globe } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function Home() {
  const [healthData, setHealthData] = useState<any>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [isHealthy, setIsHealthy] = useState<boolean>(false)

  // Handle health data changes
  const handleHealthDataChange = (data: any, error: string | null) => {
    setHealthData(data)
    setHealthError(error)

    // Check if the connection is healthy
    if (
      data &&
      data.status &&
      (data.status.toLowerCase() === "healthy" ||
        data.status.toLowerCase() === "ok" ||
        data.status.toLowerCase() === "up" ||
        data.status.toLowerCase() === "running")
    ) {
      setIsHealthy(true)
    } else {
      setIsHealthy(false)
    }
  }

  // Debug API keys (only showing if they're set, not the actual values)
  useEffect(() => {
    console.log("NEXT_PUBLIC_GROQ_API_KEY is", process.env.NEXT_PUBLIC_GROQ_API_KEY ? "set" : "not set")
    console.log("NEXT_PUBLIC_GROQ_BASE_URL is", process.env.NEXT_PUBLIC_GROQ_BASE_URL ? "set" : "not set")
  }, [])

  return (
    <main className="container mx-auto py-8 px-4 md:px-6 bg-gradient-to-b from-background to-muted/20 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Globe className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Language Tutor Assistant</h1>
        </div>

        <div className="grid gap-6">
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="bg-muted/30">
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                <CardTitle>System Connection</CardTitle>
              </div>
              <CardDescription>
                Check the connection status with Screenpipe before using the language tutor
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <HealthStatus onDataChange={handleHealthDataChange} endpoint="http://localhost:3030/health" />
            </CardContent>
          </Card>

          {!isHealthy && healthError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>
                The language tutor requires a healthy connection to Screenpipe. Please ensure Screenpipe is running and
                try again.
              </AlertDescription>
            </Alert>
          )}

          {isHealthy && (
            <Card className="border-primary/20 shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30">
                <div className="flex items-center gap-2">
                  <Languages className="h-5 w-5 text-primary" />
                  <CardTitle>Language Assistant</CardTitle>
                </div>
                <CardDescription>Real-time language assistance based on your screen content</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <LanguageTutor />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}

