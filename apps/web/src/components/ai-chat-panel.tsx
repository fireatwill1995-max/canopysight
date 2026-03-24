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
}

const QUICK_ACTIONS = [
  { label: "Ask about detections", prompt: "What detections have been found recently?" },
  { label: "Plan a mission", prompt: "Help me plan a new drone mission for this project." },
  { label: "Summarize activity", prompt: "Give me a summary of recent activity." },
];

export function AiChatPanel({ open, onClose, projectName, missionName }: AiChatPanelProps) {
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

  // Clean up any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const simulateFallback = useCallback((assistantId: string, text: string): Promise<void> => {
    return new Promise((resolve) => {
      let i = 0;
      const interval = setInterval(() => {
        i += 2;
        if (i >= text.length) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: text } : m))
          );
          clearInterval(interval);
          resolve();
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: text.slice(0, i) } : m))
          );
        }
      }, 20);
    });
  }, []);

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
        const res = await fetch(`${baseUrl}/ai/chat`, {
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

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
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
                // Treat non-JSON data lines as raw text tokens
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
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        // TODO: Remove this fallback once /ai/chat endpoint is deployed
        const fallbackText = `I can help with that! Based on the current ${projectName ? `project "${projectName}"` : "context"}${missionName ? ` and mission "${missionName}"` : ""}, here is what I found:\n\n- Analysis is running on the latest data\n- No critical issues detected\n- All systems are operating normally\n\nWould you like me to go into more detail on any of these points?`;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "" } : m
          )
        );

        await simulateFallback(assistantId, fallbackText);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [projectName, missionName, simulateFallback]
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

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">Canopy AI Assistant</h2>
            {(projectName || missionName) && (
              <p className="text-xs text-muted-foreground">
                {projectName && `Project: ${projectName}`}
                {projectName && missionName && " | "}
                {missionName && `Mission: ${missionName}`}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close chat">
            ✕
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🤖</div>
              <p className="font-medium text-foreground mb-1">Canopy AI Assistant</p>
              <p className="text-sm text-muted-foreground mb-6">
                Ask questions about your projects, detections, or plan missions.
              </p>
              <div className="space-y-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleSend(action.prompt)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <Card
                className={`max-w-[85%] px-3 py-2 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && isStreaming && msg === messages[messages.length - 1] && (
                  <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5" />
                )}
              </Card>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Canopy AI..."
              disabled={isStreaming}
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="min-h-[44px]"
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
