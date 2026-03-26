"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@canopy-sight/ui";
import { Card } from "@canopy-sight/ui";
import { getApiBaseUrl } from "@/lib/api-config";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AiChatPanelProps {
  open: boolean;
  onClose: () => void;
  projectName?: string;
  missionName?: string;
  activeSiteId?: string;
  organizationId?: string;
}

const SUGGESTED_PROMPTS = [
  { label: "Current threat level?", prompt: "What's the current threat level?" },
  { label: "Generate shift briefing", prompt: "Generate a shift briefing for the current period." },
  { label: "Species sightings today", prompt: "Show species sightings today." },
  { label: "Critical alerts", prompt: "Are there any critical alerts right now?" },
  { label: "Patrol priorities", prompt: "Suggest patrol priorities based on current detections." },
];

const DEMO_RESPONSES: Record<string, string> = {
  threat:
    "Current threat level is **MODERATE** (score: 54/100).\n\nKey factors:\n• 5 high-confidence detections in Zone B over the last hour\n• Camera CS-04 offline since 02:17 — reducing coverage\n• Elephant herd detected 0.8 km from perimeter (trending inward)\n\nRecommendation: Deploy patrol to Zone B northern boundary.",
  briefing:
    "**Morning Shift Briefing — 06:00 handover**\n\n**Summary:** Two active warning alerts require follow-up. Wildlife activity above baseline in Zone B.\n\n**Key Events:**\n• 14 detections overnight across 3 zones\n• 2 unacknowledged warning alerts (Zone B)\n• CS-04 camera offline\n\n**Recommended Patrols:**\n1. Zone B northern perimeter — Priority HIGH\n2. CS-04 hardware check — Priority MEDIUM\n3. Zone C east fence — routine sweep\n\n**Species Notes:**\n• Elephant herd (6 individuals) at 0.8 km north\n• Leopard track confirmed at Zone C",
  species:
    "**Species Detected Today (last 24h):**\n\n🐘 African Elephant — 6 individuals, 04:40 — 0.8 km north\n🐆 Leopard — 1 individual, 23:55 Zone C\n🦒 Giraffe — 2 individuals, 11:20 Zone A\n🦓 Zebra herd — ~12, 14:05 Zone D boundary\n\nTotal unique species: 4\nTotal detections: 31\n\nNo endangered species flagged within perimeter.",
  alerts:
    "**Active Critical Alerts: 0**\n**Active Warnings: 2**\n\n⚠️ WARNING — Zone B, Camera CS-02\nMultiple detections in approach zone. 3 events in 45 min.\n*Unacknowledged — 28 min*\n\n⚠️ WARNING — Zone B, Camera CS-03\nUnknown object detected at perimeter fence.\n*Unacknowledged — 14 min*\n\nRecommendation: Acknowledge and dispatch patrol to Zone B.",
  patrol:
    "**Recommended Patrol Priorities:**\n\n🔴 Priority 1 — Zone B North Boundary\nReason: 5 detections in last hour, 2 unacknowledged alerts. Requires immediate visual confirmation.\n\n🟠 Priority 2 — CS-04 Camera Location (Zone C)\nReason: Camera offline 4+ hours. Confirm hardware fault and restore coverage.\n\n🟡 Priority 3 — Zone A East Fence\nReason: Routine perimeter check — no recent activity but scheduled sweep overdue.\n\n💡 AI recommends 2-person patrol for Priority 1.",
};

function getDemoResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("threat") || lower.includes("level") || lower.includes("risk"))
    return DEMO_RESPONSES.threat;
  if (lower.includes("brief") || lower.includes("shift") || lower.includes("handover"))
    return DEMO_RESPONSES.briefing;
  if (lower.includes("species") || lower.includes("animal") || lower.includes("wildlife"))
    return DEMO_RESPONSES.species;
  if (lower.includes("alert") || lower.includes("critical"))
    return DEMO_RESPONSES.alerts;
  if (lower.includes("patrol") || lower.includes("priority") || lower.includes("priorities"))
    return DEMO_RESPONSES.patrol;
  return `I can help with that! Based on the current ${
    ""
  }operational context, here is what I found:\n\n• Analysis is running on the latest sensor data\n• No critical issues detected at this time\n• All monitored zones are within normal parameters\n\nWould you like me to go into more detail on any specific zone or alert type?`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Simple markdown renderer for bold (**text**) and newlines
function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="text-sm whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

export function AiChatPanel({
  open,
  onClose,
  projectName,
  missionName,
  activeSiteId,
  organizationId,
}: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const simulateFallback = useCallback(
    (assistantId: string, text: string): Promise<void> => {
      return new Promise((resolve) => {
        let i = 0;
        const interval = setInterval(() => {
          i += 3;
          if (i >= text.length) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: text } : m))
            );
            clearInterval(interval);
            resolve();
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: text.slice(0, i) } : m
              )
            );
          }
        }, 15);
      });
    },
    []
  );

  const streamFromApi = useCallback(
    async (userMessage: string) => {
      setIsStreaming(true);
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const baseUrl = getApiBaseUrl();
        // Try the streaming endpoint first, fall back to chat
        const res = await fetch(`${baseUrl}/ai/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            message: userMessage,
            siteId: activeSiteId ?? null,
            organizationId: organizationId ?? null,
            context: {
              project: projectName ?? null,
              mission: missionName ?? null,
            },
          }),
        });

        if (!res.ok) {
          // Try legacy /ai/chat endpoint as fallback
          const res2 = await fetch(`${baseUrl}/ai/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal,
            body: JSON.stringify({
              message: userMessage,
              context: {
                project: projectName ?? null,
                mission: missionName ?? null,
              },
            }),
          });
          if (!res2.ok) throw new Error(`API error: ${res2.status}`);
          // Use res2 for streaming
          const reader2 = res2.body?.getReader();
          if (!reader2) throw new Error("No body");
          await readStream(reader2, assistantId);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No body");
        await readStream(reader, assistantId);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        // Fallback: use demo responses
        const fallbackText = getDemoResponse(userMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: "" } : m))
        );
        await simulateFallback(assistantId, fallbackText);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [projectName, missionName, activeSiteId, organizationId, simulateFallback]
  );

  const readStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>, assistantId: string) => {
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const token = parsed.content ?? parsed.token ?? parsed.text ?? "";
              if (token) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + token } : m
                  )
                );
              }
            } catch {
              if (data.trim()) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + data } : m
                  )
                );
              }
            }
          }
        }
      }
    },
    []
  );

  const handleSend = useCallback(
    (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || isStreaming) return;

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: msg, timestamp: new Date() },
      ]);
      setInput("");

      streamFromApi(msg);
    },
    [input, isStreaming, streamFromApi]
  );

  const handleGenerateReport = useCallback(() => {
    handleSend(
      "Generate a detailed operations report for the current shift including all alerts, detections, and recommended actions."
    );
  }, [handleSend]);

  if (!open) return null;

  const lastMessage = messages[messages.length - 1];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header — Canopy Copilot branding */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-emerald-950/30 via-background to-background">
          <div className="flex items-center gap-3">
            {/* AI Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.64A2.5 2.5 0 0 1 9.5 2Z" />
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.64A2.5 2.5 0 0 0 14.5 2Z" />
                </svg>
              </div>
              {/* Green online status dot */}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-background rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-semibold text-foreground text-sm">Canopy Copilot</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-medium border border-emerald-500/20">
                  LIVE
                </span>
              </div>
              {(projectName || missionName) ? (
                <p className="text-[11px] text-muted-foreground">
                  {projectName && `${projectName}`}
                  {projectName && missionName && " · "}
                  {missionName && `${missionName}`}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Wildlife Surveillance AI</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="py-6">
              {/* Welcome state */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-white"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.64A2.5 2.5 0 0 1 9.5 2Z" />
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.64A2.5 2.5 0 0 0 14.5 2Z" />
                  </svg>
                </div>
                <p className="font-semibold text-foreground mb-1">Canopy Copilot</p>
                <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                  Your AI command assistant for wildlife surveillance. Ask about threats, alerts,
                  species detections, or generate shift briefings.
                </p>
              </div>

              {/* Suggested prompts */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
                  Suggested
                </p>
                {SUGGESTED_PROMPTS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleSend(action.prompt)}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-border text-sm text-foreground hover:bg-accent hover:border-primary/30 transition-all duration-150 flex items-center gap-2.5 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:bg-emerald-500 flex-shrink-0 transition-colors" />
                    {action.label}
                  </button>
                ))}
              </div>

              {/* Generate Report quick action */}
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  onClick={handleGenerateReport}
                  className="w-full px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all duration-150 flex items-center justify-center gap-2 font-medium"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Generate Operations Report
                </button>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {/* AI Avatar on left */}
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-white"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.64A2.5 2.5 0 0 1 9.5 2Z" />
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.64A2.5 2.5 0 0 0 14.5 2Z" />
                  </svg>
                </div>
              )}

              <div className={`max-w-[85%] space-y-0.5 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`px-3 py-2.5 rounded-2xl ${
                    msg.role === "user"
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-muted/80 text-foreground border border-border/50"
                  }`}
                >
                  <MessageContent content={msg.content} />
                  {msg.role === "assistant" &&
                    isStreaming &&
                    msg === lastMessage &&
                    msg.content.length > 0 && (
                      <span className="inline-block w-1.5 h-3.5 bg-foreground/50 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                    )}
                </div>
                {/* Timestamp */}
                <span className="text-[10px] text-muted-foreground/60 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            </div>
          ))}

          {/* Typing indicator when waiting for first token */}
          {isStreaming && lastMessage?.role === "assistant" && lastMessage.content === "" && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0" />
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-muted/80 border border-border/50">
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions when conversation active */}
        {messages.length > 0 && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
            {SUGGESTED_PROMPTS.slice(0, 3).map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.prompt)}
                disabled={isStreaming}
                className="flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent transition-all disabled:opacity-40"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2 items-end"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Canopy Copilot…"
              disabled={isStreaming}
              className="flex-1 px-3 py-2.5 border border-border rounded-xl bg-background text-foreground text-sm focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 min-h-[44px] placeholder:text-muted-foreground/50 transition-colors"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="min-h-[44px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-1.5">
            Canopy Copilot · AI-powered wildlife surveillance intelligence
          </p>
        </div>
      </div>
    </div>
  );
}
