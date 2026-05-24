import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { checkInId } = await req.json();

    if (!checkInId) {
      return NextResponse.json(
        { error: "Missing checkInId" },
        { status: 400 },
      );
    }

    // Fetch all messages (student message was already saved by the frontend)
    const messages = await convex.query(api.checkIns.listMessages, {
      checkInId,
    });

    // Build conversation history for Claude
    const conversationHistory = messages.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.body,
    }));

    const exchangeCount = messages.filter((m) => m.role === "student").length;

    const { text: aiResponse } = await generateText({
      model: openrouter("openrouter/free"),
      system: `You are a relaxed but professional AI Teaching Assistant doing a quick 1-on-1 check-in with a student. You want to map what they understand and what's fuzzy -- nothing more.

RULES:
- Do NOT teach, correct, or explain. If they're wrong, note it mentally and move on.
- 2 sentences max per response. One sentence is even better.
- Ask about a specific topic they haven't covered yet, or dig into something they mentioned.
- Sound like a chill teacher checking in, not a formal survey.
- No bullet points, no lists, no filler phrases.

${exchangeCount >= 5 ? "Wrap up in one casual sentence -- something like 'Cool, I've got a good read on where you're at -- we'll get you matched up with a study group soon.'" : "Keep probing their understanding of different lesson topics."}`,
      messages: conversationHistory,
      maxOutputTokens: 150,
    });

    // Save AI response
    await convex.mutation(api.checkIns.addAssistantMessage, {
      checkInId,
      body: aiResponse,
    });

    const suggestComplete = exchangeCount >= 5;

    return NextResponse.json({ aiResponse, suggestComplete });
  } catch (error) {
    console.error("Check-in respond error:", error);
    return NextResponse.json(
      { error: "Failed to process response" },
      { status: 500 },
    );
  }
}
