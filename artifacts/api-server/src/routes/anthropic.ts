import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /anthropic/conversations
router.get("/anthropic/conversations", async (_req, res): Promise<void> => {
  const conversations = await db.select().from(conversationsTable).orderBy(conversationsTable.createdAt);
  res.json(conversations);
});

// POST /anthropic/conversations
router.post("/anthropic/conversations", async (req, res): Promise<void> => {
  const { title } = req.body as { title: string };
  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  const [conv] = await db.insert(conversationsTable).values({ title }).returning();
  res.status(201).json(conv);
});

// GET /anthropic/conversations/:id
router.get("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id));
  res.json({ ...conv, messages: msgs });
});

// DELETE /anthropic/conversations/:id
router.delete("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [conv] = await db.delete(conversationsTable).where(eq(conversationsTable.id, id)).returning();
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});

// GET /anthropic/conversations/:id/messages
router.get("/anthropic/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id));
  res.json(msgs);
});

// POST /anthropic/conversations/:id/messages (SSE stream)
router.post("/anthropic/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { content } = req.body as { content: string };
  if (!content) { res.status(400).json({ error: "Content is required" }); return; }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.insert(messagesTable).values({ conversationId: id, role: "user", content });

  const allMsgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id));
  const chatMessages = allMsgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    logger.error({ err }, "Anthropic stream error");
    res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
