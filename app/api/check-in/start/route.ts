import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { sessionCode, sessionId } = await req.json();

    if (!sessionCode || !sessionId) {
      return NextResponse.json(
        { error: "Missing sessionCode or sessionId" },
        { status: 400 },
      );
    }

    // Get the lesson summary
    const teachingSession = await convex.query(api.teaching.getCaptureSession, {
      sessionCode,
    });

    if (!teachingSession?.summary) {
      return NextResponse.json(
        { error: "No lesson summary available" },
        { status: 400 },
      );
    }

    const lessonSummary = teachingSession.summary;

    // Get all participants (non-creator members)
    const members = await convex.query(api.sessionMembers.listMembersSystem, {
      sessionId,
    });

    const students = members.filter(
      (m) => m.role === "participant" || m.role === "student",
    );

    if (students.length === 0) {
      return NextResponse.json(
        { error: "No students in session" },
        { status: 400 },
      );
    }

    // Set check-in phase
    await convex.mutation(api.teaching.setCheckInPhase, {
      sessionCode,
      checkInPhase: "checking-in",
    });

    // For each student, generate a personalized opening message and create check-in
    const results = await Promise.all(
      students.map(async (student) => {
        const { text: openingMessage } = await generateText({
          model: openrouter("openrouter/free"),
          messages: [
            {
              role: "user",
              content: `You are a relaxed but professional AI Teaching Assistant checking in with a student after a lesson. You want to understand what clicked and what didn't -- you are NOT here to teach.

Lesson summary:
${lessonSummary}

Student name: ${student.name}

Write a 2-sentence opening. First sentence: greet them by name and mention one topic from the lesson. Second sentence: ask what made sense and what didn't. Sound like a chill teacher, not a corporate chatbot. No bullet points, no lists, no fluff.`,
            },
          ],
          maxOutputTokens: 150,
        });

        const checkInId = await convex.mutation(api.checkIns.startCheckIn, {
          sessionId,
          userId: student.userId,
          lessonSummary,
          openingMessage,
        });

        return { studentId: student.userId, checkInId };
      }),
    );

    return NextResponse.json({ started: results.length, results });
  } catch (error) {
    console.error("Check-in start error:", error);
    return NextResponse.json(
      { error: "Failed to start check-ins" },
      { status: 500 },
    );
  }
}
