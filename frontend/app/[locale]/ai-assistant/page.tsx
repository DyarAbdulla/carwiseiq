import type { Metadata } from "next"
import { AiAssistantClient } from "./AiAssistantClient"

export const metadata: Metadata = {
  title: "AI Assistant | CarWiseIQ",
  description:
    "Ask CarWiseIQ about car valuations, buying and selling in Iraq and Kurdistan.",
}

export default function AiAssistantPage() {
  return <AiAssistantClient />
}
