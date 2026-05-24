import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { sessionId, sessionCode } = await req.json();

    if (!sessionId || !sessionCode) {
      return NextResponse.json(
        { error: "Missing sessionId or sessionCode" },
        { status: 400 },
      );
    }

    // Set phase to matching
    await convex.mutation(api.teaching.setCheckInPhase, {
      sessionCode,
      checkInPhase: "matching",
    });

    // Get all comprehension profiles
    const profiles = await convex.query(api.comprehension.getBySession, {
      sessionId,
    });

    if (profiles.length < 2) {
      return NextResponse.json(
        { error: "Not enough profiles to match" },
        { status: 400 },
      );
    }

    // Get all session members to find non-responders
    const members = await convex.query(api.sessionMembers.listMembersSystem, {
      sessionId,
    });
    const students = members.filter(
      (m) => m.role === "participant" || m.role === "student",
    );

    const profiledIds = new Set(profiles.map((p) => p.userId));
    const unmatchedIds = students
      .filter((s) => !profiledIds.has(s.userId))
      .map((s) => s.userId);

    // Build student profiles for Claude
    const studentProfiles = await Promise.all(
      profiles.map(async (p) => {
        const member = students.find((s) => s.userId === p.userId);
        return {
          studentId: p.userId,
          name: member?.name ?? "Unknown",
          topics: p.topics,
          overallSummary: p.overallSummary,
        };
      }),
    );

    const { text: matchJson } = await generateText({
      model: openrouter("openrouter/free"),
      messages: [
        {
          role: "user",
          content: `You are forming study groups from student comprehension profiles. Your goal is to create COMPLEMENTARY groups where students' strengths fill each other's gaps.

STUDENT PROFILES:
${JSON.stringify(studentProfiles, null, 2)}

RULES:
1. Maximize complementary coverage -- group students whose strengths fill each other's gaps. For each topic, at least one group member should understand it well enough to help the others.
2. Group size: 3-5 students per group. NEVER create pairs of only 2. Aim for 3-4 students per group as the sweet spot. Only go to 5 if it produces better knowledge distribution.
3. Every profiled student must be in exactly one group
4. Give each group a descriptive name and a reason explaining the pairing logic

Respond with ONLY valid JSON in this exact format:
{
  "groups": [
    {
      "name": "Group Name",
      "memberIds": ["userId1", "userId2"],
      "reason": "Why these students are paired together"
    }
  ]
}

IMPORTANT: Use the exact studentId values from the profiles as memberIds.`,
        },
      ],
      maxOutputTokens: 2000,
    });

    let matchResult;
    try {
      const cleaned = matchJson.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      matchResult = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse match JSON. Raw output:", matchJson);
      console.error("Parse error:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse matching result", raw: matchJson.substring(0, 500) },
        { status: 500 },
      );
    }

    // Save proposed matches
    await convex.mutation(api.matches.saveProposedMatches, {
      sessionId,
      groups: matchResult.groups,
      unmatchedIds,
    });

    // Set phase to matched
    await convex.mutation(api.teaching.setCheckInPhase, {
      sessionCode,
      checkInPhase: "matched",
    });

    return NextResponse.json({
      groups: matchResult.groups,
      unmatchedIds,
    });
  } catch (error) {
    console.error("Compute matches error:", error);
    return NextResponse.json(
      { error: "Failed to compute matches" },
      { status: 500 },
    );
  }
}
