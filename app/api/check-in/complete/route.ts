import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { checkInId, sessionId, sessionCode } = await req.json();

    if (!checkInId || !sessionId || !sessionCode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Fetch all messages for this check-in
    const messages = await convex.query(api.checkIns.listMessages, {
      checkInId,
    });

    // Get the lesson summary from the teaching session
    const teachingSession = await convex.query(api.teaching.getCaptureSession, {
      sessionCode,
    });

    const lessonSummary = teachingSession?.summary ?? "No lesson summary available.";

    // Build conversation transcript
    const transcript = messages
      .map((m) => `${m.role === "assistant" ? "AI" : "Student"}: ${m.body}`)
      .join("\n\n");

    // Extract comprehension profile using Claude
    const { text: profileJson } = await generateText({
      model: openrouter("openrouter/free"),
      messages: [
        {
          role: "user",
          content: `You are analyzing a check-in conversation between an AI Teaching Assistant and a student to extract a structured comprehension profile.

LESSON SUMMARY:
${lessonSummary}

CONVERSATION:
${transcript}

Based on this conversation, extract a JSON comprehension profile. Identify each topic from the lesson and assess the student's understanding.

Respond with ONLY valid JSON in this exact format:
{
  "topics": [
    {
      "name": "Topic Name",
      "understood": true/false,
      "confidence": "high" | "medium" | "low",
      "notes": "Brief note about what the student said or struggled with"
    }
  ],
  "overallSummary": "1-2 sentence summary of the student's overall comprehension"
}

Be accurate based on what the student actually said. If a topic wasn't discussed, mark confidence as "low" and note it wasn't covered.`,
        },
      ],
      maxOutputTokens: 800,
    });

    // Parse the profile
    let profile;
    try {
      // Strip markdown code fences if present
      const cleaned = profileJson.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      profile = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse profile JSON:", profileJson);
      profile = {
        topics: [],
        overallSummary: "Could not extract comprehension profile.",
      };
    }

    // Get the check-in to find the userId
    const checkInStatus = await convex.query(api.checkIns.getSessionCheckInStatus, {
      sessionId,
    });
    const thisCheckIn = checkInStatus.checkIns.find((c) => c._id === checkInId);
    if (!thisCheckIn) {
      return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
    }

    // Save comprehension profile
    await convex.mutation(api.comprehension.saveProfile, {
      sessionId,
      userId: thisCheckIn.userId,
      checkInId,
      topics: profile.topics,
      overallSummary: profile.overallSummary,
    });

    // Mark check-in as completed
    await convex.mutation(api.checkIns.completeCheckIn, { checkInId });

    const updatedStatus = await convex.query(api.checkIns.getSessionCheckInStatus, {
      sessionId,
    });

    return NextResponse.json({
      profile,
      completed: updatedStatus.completed,
      total: updatedStatus.total,
    });
  } catch (error) {
    console.error("Check-in complete error:", error);
    return NextResponse.json(
      { error: "Failed to complete check-in" },
      { status: 500 },
    );
  }
}
