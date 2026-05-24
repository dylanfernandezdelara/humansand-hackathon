import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { sessionCode } = await req.json();

    if (!sessionCode) {
      return NextResponse.json(
        { error: "Missing sessionCode" },
        { status: 400 },
      );
    }

    // Mark session as synthesizing
    await convex.mutation(api.teaching.setCaptureStatus, {
      sessionCode,
      status: "synthesizing",
    });

    // Fetch all snapshots for this session
    const snapshots = await convex.query(api.teaching.getCaptureSnapshots, {
      sessionCode,
    });

    if (!snapshots.length) {
      const emptySummary =
        "No whiteboard content was captured during this teaching session.";
      await convex.mutation(api.teaching.completeCapture, {
        sessionCode,
        summary: emptySummary,
      });
      return NextResponse.json({ summary: emptySummary });
    }

    // Sort chronologically and build the timeline
    const sorted = [...snapshots].sort((a, b) => a.capturedAt - b.capturedAt);
    const timeline = sorted
      .map(
        (s, i) =>
          `[Snapshot ${i + 1} — ${new Date(s.capturedAt).toLocaleTimeString()}]\n${s.description}`,
      )
      .join("\n\n");

    const { text: summary } = await generateText({
      model: openrouter("openrouter/free"),
      messages: [
        {
          role: "user",
          content: `You are synthesizing a lesson from a series of whiteboard snapshots taken during a live teaching session. Below is a chronological timeline of what was observed on the whiteboard at different points:

${timeline}

Based on these snapshots, write a structured lesson summary that:
1. Identifies the main topic(s) being taught
2. Explains the key concepts in logical order (not necessarily chronological)
3. Notes any important diagrams, formulas, or visual aids that were used
4. Captures the progression of ideas (how the teacher built up the explanation)

Write the summary in clear, educational prose. Use markdown formatting with headers. Keep it concise but comprehensive — aim for 200-400 words.`,
        },
      ],
      maxOutputTokens: 800,
    });

    await convex.mutation(api.teaching.completeCapture, {
      sessionCode,
      summary,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Synthesize lesson error:", error);
    return NextResponse.json(
      { error: "Failed to synthesize lesson" },
      { status: 500 },
    );
  }
}
