import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, sessionCode, elementHash } = await req.json();

    if (!imageBase64 || !sessionCode) {
      return NextResponse.json(
        { error: "Missing imageBase64 or sessionCode" },
        { status: 400 },
      );
    }

    const { text: description } = await generateText({
      model: openrouter("openrouter/free"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: imageBase64,
            },
            {
              type: "text",
              text: `You are a high-fidelity teaching content transcriber. Your job is to capture EVERYTHING visible on this whiteboard with maximum detail and accuracy. This will be used to reconstruct what was taught.

Transcribe the whiteboard content following these rules:

1. **Exact Text**: Reproduce ALL text word-for-word. Include titles, labels, definitions, code snippets, annotations — every piece of readable text exactly as written.

2. **Formulas & Equations**: Transcribe mathematical notation precisely (e.g., "O(log n)", "f(x) = 2x + 1", "∑"). Use LaTeX-style notation if helpful.

3. **Diagrams & Visuals**: Describe the structure in detail — what shapes exist, what they contain, how they connect (arrows, lines), direction of flow, and what each element represents.

4. **Spatial Layout**: Note how content is organized — sections, groupings, columns. If items are in a list, preserve the list structure. If content is in separate areas, note that.

5. **Color & Emphasis**: Note any color coding, highlighting, boxing, underlining, or other visual emphasis used by the teacher.

6. **Data Structures**: If tables, arrays, trees, or graphs are drawn, capture their exact contents and structure.

If the whiteboard is empty or has only minimal marks with no meaningful content, respond with exactly: "No meaningful content yet."

Be thorough — capture everything. Do NOT summarize or interpret. Transcribe.`,
            },
          ],
        },
      ],
      maxOutputTokens: 800,
    });

    await convex.mutation(api.teaching.addSnapshot, {
      sessionCode,
      description,
      elementHash: elementHash ?? 0,
      capturedAt: Date.now(),
    });

    return NextResponse.json({ description });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    let errorInfo: Record<string, unknown> = {};
    try { errorInfo = JSON.parse(JSON.stringify(error)); } catch {}
    console.error("Analyze snapshot error full:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return NextResponse.json(
      { error: "Failed to analyze snapshot", detail, errorInfo },
      { status: 500 },
    );
  }
}
