"use node";

import crypto from "crypto";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
import { z } from "zod";

const evalSchema = z.object({
  shouldRespond: z.boolean().describe("Whether to respond. Default to false unless a clear trigger is detected."),
  trigger: z.enum(["misconception", "stuck", "shallow", "comprehension_check"]).nullable().describe("Which failure mode was detected, or null"),
  message: z.string().describe("The short peer-style message to send. Only used if shouldRespond is true."),
});

const summarySchema = z.object({
  overallSummary: z.string().describe("General takeaway of the group discussion - what was understood, what was not"),
  participants: z.array(
    z.object({
      userId: z.string().describe("The user's internal ID"),
      name: z.string().describe("The user's display name"),
      strengths: z.array(z.string()).describe("Topics or concepts this student understood well"),
      weaknesses: z.array(z.string()).describe("Topics or concepts this student struggled with or showed gaps in"),
    })
  ),
});

type GroupSummary = z.infer<typeof summarySchema>;

function formatSummaryForChat(summary: GroupSummary): string {
  let text = `**Group Summary**\n\n${summary.overallSummary}\n`;

  for (const p of summary.participants) {
    text += `\n**${p.name}**\n`;
    if (p.strengths.length > 0) {
      text += `- Strengths: ${p.strengths.join(", ")}\n`;
    }
    if (p.weaknesses.length > 0) {
      text += `- Gaps: ${p.weaknesses.join(", ")}\n`;
    }
  }

  return text;
}

const diagramSchema = z.object({
  unchanged: z.boolean().describe("Set to true if the current diagram is still relevant and no changes needed"),
  title: z.optional(z.string()).describe("Short title for the diagram. Omit if unchanged."),
  nodes: z.optional(z.array(z.object({
    id: z.string(),
    label: z.string(),
    shape: z.enum(["rectangle", "ellipse"]),
  }))).describe("Up to 6 nodes. Omit if unchanged."),
  edges: z.optional(z.array(z.object({
    from: z.string().describe("Node ID"),
    to: z.string().describe("Node ID"),
  }))).describe("Up to 8 edges. Omit if unchanged."),
});

function convertDSLToExcalidraw(dsl: { title?: string; nodes?: { id: string; label: string; shape: string }[]; edges?: { from: string; to: string }[] }): string {
  const elements: Record<string, unknown>[] = [];
  const now = Date.now();
  const nodeWidth = 160;
  const nodeHeight = 70;
  const colSpacing = 220;
  const rowSpacing = 140;
  const maxPerRow = 3;
  const startX = 40;
  const startY = 80;

  function makeBase(type: string, x: number, y: number, w: number, h: number) {
    return {
      id: crypto.randomUUID(),
      type,
      x,
      y,
      width: w,
      height: h,
      angle: 0,
      strokeColor: "#6366f1",
      backgroundColor: "#e0e7ff",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      index: "a0",
      roundness: null,
      seed: Math.floor(Math.random() * 2_000_000_000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 2_000_000_000),
      isDeleted: false,
      boundElements: null,
      updated: now,
      link: null,
      locked: false,
    };
  }

  if (dsl.title) {
    const fontSize = 20;
    const tw = Math.max(dsl.title.length * fontSize * 0.55, 40);
    const th = fontSize * 1.35;
    elements.push({
      ...makeBase("text", startX, 20, tw, th),
      text: dsl.title,
      fontSize,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      lineHeight: 1.35,
      baseline: Math.round(fontSize),
      containerId: null,
      originalText: dsl.title,
      autoResize: true,
    });
  }

  const nodePositions = new Map<string, { cx: number; cy: number }>();

  if (dsl.nodes) {
    for (let i = 0; i < dsl.nodes.length; i++) {
      const node = dsl.nodes[i];
      const col = i % maxPerRow;
      const row = Math.floor(i / maxPerRow);
      const x = startX + col * colSpacing;
      const y = startY + row * rowSpacing;

      const shapeEl = {
        ...makeBase(node.shape === "ellipse" ? "ellipse" : "rectangle", x, y, nodeWidth, nodeHeight),
      };
      elements.push(shapeEl);

      const fontSize = 16;
      const tw = Math.max(node.label.length * fontSize * 0.55, 40);
      const th = fontSize * 1.35;
      const tx = x + (nodeWidth - tw) / 2;
      const ty = y + (nodeHeight - th) / 2;

      elements.push({
        ...makeBase("text", tx, ty, tw, th),
        text: node.label,
        fontSize,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1.35,
        baseline: Math.round(fontSize),
        containerId: null,
        originalText: node.label,
        autoResize: true,
      });

      nodePositions.set(node.id, { cx: x + nodeWidth / 2, cy: y + nodeHeight / 2 });
    }
  }

  if (dsl.edges) {
    for (const edge of dsl.edges) {
      const fromPos = nodePositions.get(edge.from);
      const toPos = nodePositions.get(edge.to);
      if (!fromPos || !toPos) continue;

      const dx = toPos.cx - fromPos.cx;
      const dy = toPos.cy - fromPos.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) continue;

      // Offset start/end to the edge of the node boxes
      const ux = dx / dist;
      const uy = dy / dist;
      const startOffsetX = ux * (nodeWidth / 2 + 4);
      const startOffsetY = uy * (nodeHeight / 2 + 4);
      const endOffsetX = ux * (nodeWidth / 2 + 4);
      const endOffsetY = uy * (nodeHeight / 2 + 4);

      const sx = fromPos.cx + startOffsetX;
      const sy = fromPos.cy + startOffsetY;
      const ex = toPos.cx - endOffsetX;
      const ey = toPos.cy - endOffsetY;
      const adx = ex - sx;
      const ady = ey - sy;

      elements.push({
        ...makeBase("arrow", sx, sy, Math.abs(adx), Math.abs(ady)),
        points: [[0, 0], [adx, ady]],
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: "arrow",
        roundness: { type: 2 },
        lastCommittedPoint: null,
        elbowed: false,
      });
    }
  }

  return JSON.stringify(elements);
}

const DIAGRAM_COOLDOWN_MS = 10_000; // 10s for testing, bump to 60_000 for prod

export const updateDiagram = internalAction({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const group = await ctx.runQuery(internal.groups.getById, { groupId });
    if (!group || group.endedAt) return;

    const diagramUpdatedAt = group.diagramUpdatedAt;
    if (diagramUpdatedAt && Date.now() - diagramUpdatedAt < DIAGRAM_COOLDOWN_MS) return;

    const messages = await ctx.runQuery(
      internal.messages.getRecentGroupMessagesWithTime,
      { groupId }
    );
    if (messages.length === 0) return;

    const previousDiagram = group.diagram ? group.diagram : null;

    const conversationText = messages
      .map((m) => `${m.authorName}: ${m.body}`)
      .join("\n");

    let previousDiagramSection = "";
    if (previousDiagram) {
      previousDiagramSection = `\nYour current diagram:\n${previousDiagram}\nYou can modify this by adding/removing/changing nodes and edges, or set unchanged: true if it's still relevant.\n`;
    }

    let whiteboardText = "";
    try {
      const elements = await ctx.runQuery(internal.whiteboard.getElements, {
        roomId: `group-${groupId}`,
      });
      const parsed: { type?: string; text?: string }[] = JSON.parse(elements);
      const texts = parsed
        .filter((el) => el.type === "text" && el.text)
        .map((el) => el.text!.trim())
        .filter(Boolean);
      if (texts.length > 0) {
        whiteboardText = texts.join("\n");
      }
    } catch {
      // Non-fatal: proceed without whiteboard context
    }

    try {
      const { object: result } = await generateObject({
        model: openrouter("openrouter/free"),
        schema: diagramSchema,
        prompt: `You are a visual learning assistant. Based on the group conversation, maintain a simple diagram that helps illustrate the concept being discussed.

You do NOT have perfect knowledge. Your diagram should reflect what the students are discussing, not necessarily the "correct" answer.

The group is studying: ${group.name}
${previousDiagramSection}
Rules:
- Max 6 nodes, max 8 edges
- Keep labels short (1-4 words)
- The diagram should help students visualize relationships and concepts
- If the conversation doesn't need a diagram, set unchanged: true
- If the topic has shifted significantly, replace the diagram entirely
- Use shapes meaningfully: rectangles for concrete things, ellipses for concepts/processes
${whiteboardText ? `\nThe group's whiteboard currently contains this text:\n${whiteboardText}\n\nUse this to better understand what the students are working through visually.\n` : ""}
Recent conversation:
${conversationText}`,
      });

      if (result.unchanged) return;

      const dslJson = JSON.stringify({
        title: result.title,
        nodes: result.nodes,
        edges: result.edges,
      });

      const saved = await ctx.runMutation(internal.groups.saveDiagramIfFresh, {
        groupId,
        diagram: dslJson,
        expectedUpdatedAt: diagramUpdatedAt,
      });

      if (!saved) return;

      const excalidrawElements = convertDSLToExcalidraw({
        title: result.title,
        nodes: result.nodes,
        edges: result.edges,
      });

      await ctx.runMutation(internal.whiteboard.saveElementsInternal, {
        roomId: `ai-board-${groupId}`,
        elements: excalidrawElements,
      });
    } catch (error) {
      console.error("AI diagram update failed:", error);
    }
  },
});

// Set to true for demo — AI responds more aggressively to show off all 3 triggers.
const DEMO_MODE = false;

export const evaluateGroupChat = internalAction({
  args: {
    groupId: v.id("groups"),
    trigger: v.union(v.literal("content"), v.literal("dead_air")),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, { groupId, trigger, scheduledAt }) => {
    const group = await ctx.runQuery(internal.groups.getById, { groupId });
    if (!group || group.endedAt) return;

    const messages = await ctx.runQuery(
      internal.messages.getRecentGroupMessagesWithTime,
      { groupId }
    );

    if (messages.length === 0 && trigger === "dead_air") return;

    let studentCount = 0;
    let lastAiTime: number | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "ai") {
        lastAiTime = messages[i]._creationTime;
        break;
      }
      studentCount++;
    }

    if (trigger === "content") {
      if (studentCount < 2) return;
    } else {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && scheduledAt && lastMsg._creationTime > scheduledAt) return;
      if (lastAiTime && Date.now() - lastAiTime < 20 * 1000) return;
    }

    const conversationText = messages
      .map((m) => `${m.authorName}: ${m.body}`)
      .join("\n");

    let whiteboardText = "";
    try {
      const elements = await ctx.runQuery(internal.whiteboard.getElements, {
        roomId: `group-${groupId}`,
      });
      const parsed: { type?: string; text?: string }[] = JSON.parse(elements);
      const texts = parsed
        .filter((el) => el.type === "text" && el.text)
        .map((el) => el.text!.trim())
        .filter(Boolean);
      if (texts.length > 0) {
        whiteboardText = texts.join("\n");
      }
    } catch {
      // Non-fatal: proceed without whiteboard context
    }

    try {
      const { object: evaluation } = await generateObject({
        model: openrouter("openrouter/free"),
        schema: evalSchema,
        prompt: `You are a fellow student in a peer study group, NOT a teacher or tutor. You're reviewing the recent conversation to decide if you should chime in.

You do NOT have perfect knowledge of the subject matter. You might be wrong too. Frame your interventions as genuine curiosity or confusion, not as corrections from authority. If you think something might be off, question it -- but acknowledge you could be the one who's mistaken. Say things like "wait, I might be wrong but..." or "hmm I'm not sure that's right, wouldn't [X] mean...?"

The group is studying: ${group.name}

IMPORTANT: Most of the time, the conversation is going fine and you should NOT respond. Only respond if you clearly detect one of these three problems:

1. MISCONCEPTION: A student is explaining something incorrectly to another student. This is the most critical -- wrong info spreading is worse than no learning. But ONLY intervene if the misconception goes unchallenged -- if another student already questioned it or is working through it, stay out. Don't correct directly and NEVER hint at the right answer. Just ask a short, confused question that highlights the ambiguity. Let the students figure it out.
   Example: "wait, which ones are you multiplying together?" or "hmm are you sure about that part?"
   BAD example (too revealing): "wouldn't you multiply by the OTHER fraction?" -- this gives away the answer.

2. STUCK: The conversation has stalled -- students are saying "idk", "i dont understand", going silent, or going in circles. This includes when YOU previously asked a question and nobody could answer it or they said they're still confused. In that case, try a different angle -- break the problem down smaller, suggest thinking about a specific concrete example, or reframe the question in a simpler way. Don't just repeat your previous question. NEVER reference "class", "the professor", "the lecture", or anything you haven't directly seen in this conversation -- you don't have that context and will make things up.
   Example: "what if you try writing out a specific example with numbers?" or "maybe break it into smaller steps?" or "ok let me think about this differently -- what do we know for sure so far?"

3. SHALLOW AGREEMENT: Students are agreeing with each other but their understanding is surface-level -- parroting definitions without real comprehension. Only intervene if this pattern persists across multiple messages -- not just one agreement. Ask a probing edge-case question to test depth.
   Example: "ok but what happens if the input is empty?" or "would that still work with duplicates?"

4. COMPREHENSION CHECK: A student who was struggling with something seems to have learned it from a peer, but it's not clear they actually understood -- they just said "oh ok" or "makes sense" without demonstrating understanding. Ask one casual follow-up question to check. Do NOT keep quizzing them -- one question is enough. If they already explained it back in their own words, they understood and you should stay out.
   Example: "so wait, could you explain that back to me? I'm still confused" or "so what would happen if we tried it with [different input]?"

Rules:
- If the conversation is productive and students are learning, respond with shouldRespond: false
- Keep your message to 1-2 short sentences, like a real student would text
- Never use formal language, bullet points, or long explanations
- Never say "great question" or "that's interesting" -- be natural
- Ask questions, never give answers
- You are a peer who might also be wrong, not an authority
- NEVER reference "class", "the professor", "the lecture", or "the board" -- you only know what's in this conversation
${DEMO_MODE ? "" : "- When in doubt, don't respond"}
${whiteboardText ? `\nThe group's whiteboard currently contains:\n${whiteboardText}\n\nUse this to silently inform your understanding of what the students are working on. Do NOT reference the whiteboard directly in your message.\n` : ""}
Recent conversation:
${conversationText}`,
      });

      if (evaluation.shouldRespond) {
        await ctx.runMutation(internal.messages.postAIMessage, {
          groupId,
          body: evaluation.message,
          source: "nudge",
        });
      }
    } catch (error) {
      console.error("AI group evaluation failed:", error);
    }

    await ctx.scheduler.runAfter(90_000, internal.ai.evaluateGroupChat, {
      groupId,
      trigger: "dead_air",
      scheduledAt: Date.now(),
    });
  },
});

export const summarizeGroup = internalAction({
  args: {
    groupId: v.id("groups"),
    whiteboardContext: v.optional(v.string()),
  },
  handler: async (ctx, { groupId }) => {
    const group = await ctx.runQuery(internal.groups.getById, { groupId });
    if (!group) {
      await ctx.runMutation(internal.groups.saveSummary, {
        groupId,
        summary: JSON.stringify({ error: true, message: "Summary could not be generated." }),
      });
      await ctx.runMutation(internal.messages.postAIMessage, {
        groupId,
        body: "Summary could not be generated.",
      });
      return;
    }

    const allMessages = await ctx.runQuery(
      internal.messages.getGroupMessages,
      { groupId }
    );

    if (allMessages.length === 0) {
      await ctx.runMutation(internal.groups.saveSummary, {
        groupId,
        summary: JSON.stringify({ error: true, message: "No messages to summarize." }),
      });
      await ctx.runMutation(internal.messages.postAIMessage, {
        groupId,
        body: "No messages to summarize.",
      });
      return;
    }

    try {
      let messagesToUse = allMessages;
      if (messagesToUse.length > 100) {
        messagesToUse = [
          ...messagesToUse.slice(0, 10),
          ...messagesToUse.slice(-90),
        ];
      }

      const conversationText = messagesToUse
        .map((m) => {
          const body =
            m.body.length > 500 ? m.body.slice(0, 500) + "..." : m.body;
          return `${m.authorName}: ${body}`;
        })
        .join("\n");

      const participants = [
        ...new Map(
          allMessages
            .filter((m) => m.role !== "ai" && m.authorId)
            .map((m) => [m.authorId, m.authorName])
        ).entries(),
      ].map(([id, name]) => ({ userId: id as string, name: name as string }));

      const { object: summary } = await generateObject({
        model: openrouter("openrouter/free"),
        maxRetries: 3,
        schema: summarySchema,
        prompt: `You are an AI teaching assistant analyzing a student group discussion.

Participants (with internal IDs):
${participants.map((p) => `- ${p.name} (ID: ${p.userId})`).join("\n")}

Conversation:
${conversationText}

Analyze the discussion and for each participant, identify what topics/concepts they understood well (strengths) and where they showed gaps or confusion (weaknesses). Also provide an overall summary of the group's discussion.

Use the exact user IDs provided above in your response.`,
      });

      await ctx.runMutation(internal.groups.saveSummary, {
        groupId,
        summary: JSON.stringify(summary),
      });

      await ctx.runMutation(internal.messages.postAIMessage, {
        groupId,
        body: formatSummaryForChat(summary),
      });
    } catch (error) {
      console.error("AI summary failed:", error);
      await ctx.runMutation(internal.groups.saveSummary, {
        groupId,
        summary: JSON.stringify({ error: true, message: "Summary could not be generated." }),
      });
      await ctx.runMutation(internal.messages.postAIMessage, {
        groupId,
        body: "Summary could not be generated.",
      });
    }
  },
});
