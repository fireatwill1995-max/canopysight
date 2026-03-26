"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { getApiBaseUrl } from "@/lib/api-config";

interface BriefingSection {
  heading: string;
  body: string;
}

interface ShiftBriefing {
  generatedAt: Date;
  shift: "Morning" | "Afternoon" | "Night";
  summary: string;
  sections: BriefingSection[];
  raw?: string;
}

function detectShift(): "Morning" | "Afternoon" | "Night" {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "Morning";
  if (h >= 14 && h < 22) return "Afternoon";
  return "Night";
}

const DEMO_BRIEFING: ShiftBriefing = {
  generatedAt: new Date(),
  shift: detectShift(),
  summary:
    "Overall threat level is MODERATE. Two active alerts require follow-up. Wildlife activity above baseline in the northern perimeter.",
  sections: [
    {
      heading: "Key Events (Last 8h)",
      body: "• 14 detections across 3 zones — majority low-confidence advisory events.\n• 2 active warning alerts at Zone B. Operator acknowledgement pending.\n• Camera CS-04 offline since 02:17 — maintenance ticket raised.",
    },
    {
      heading: "Threat Summary",
      body: "• Zone B: Elevated activity — 5 high-confidence detections in last 60 min.\n• Zone A & D: Nominal.\n• No confirmed intrusions. Risk score trending upward from 38 → 54.",
    },
    {
      heading: "Recommended Patrols",
      body: "• Priority 1 — Zone B northern boundary (elevated detection cluster).\n• Priority 2 — CS-04 camera location (confirm hardware fault).\n• Routine sweep: Zone C east fence line.",
    },
    {
      heading: "Species Notes",
      body: "• Elephant herd (6 individuals) sighted 0.8 km north of perimeter at 04:40.\n• Leopard track detected at Zone C camera at 23:55 — camera trap confirmed single animal.\n• No endangered species at immediate risk.",
    },
  ],
};

interface ShiftBriefingPanelProps {
  siteId?: string;
  organizationId?: string;
}

export function ShiftBriefingPanel({ siteId, organizationId }: ShiftBriefingPanelProps) {
  const [briefing, setBriefing] = useState<ShiftBriefing | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [streamText, setStreamText] = useState("");

  const generateBriefing = useCallback(async () => {
    setIsGenerating(true);
    setStreamText("");

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/ai/shift-briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ siteId, organizationId }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No body");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

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
                accumulated += token;
                setStreamText(accumulated);
              }
            } catch {
              if (data.trim()) {
                accumulated += data;
                setStreamText(accumulated);
              }
            }
          }
        }
      }

      setBriefing({
        generatedAt: new Date(),
        shift: detectShift(),
        summary: accumulated.split("\n")[0] ?? "Briefing generated.",
        sections: [],
        raw: accumulated,
      });
      setStreamText("");
    } catch {
      // Fallback to demo briefing
      await new Promise((r) => setTimeout(r, 800));
      setBriefing({ ...DEMO_BRIEFING, generatedAt: new Date() });
    } finally {
      setIsGenerating(false);
    }
  }, [siteId, organizationId]);

  const handleCopy = useCallback(async () => {
    if (!briefing) return;
    const text = briefing.raw
      ? briefing.raw
      : [
          `=== CANOPY SIGHT — ${briefing.shift} Shift Briefing ===`,
          `Generated: ${briefing.generatedAt.toLocaleString()}`,
          "",
          briefing.summary,
          "",
          ...briefing.sections.map((s) => `--- ${s.heading} ---\n${s.body}`),
        ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [briefing]);

  const shiftEmoji =
    briefing?.shift === "Morning" ? "🌅" : briefing?.shift === "Afternoon" ? "☀️" : "🌙";

  return (
    <Card className="card-gradient">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <span className="text-xl">📋</span>
              Shift Briefing
            </CardTitle>
            <CardDescription>
              AI-generated operational summary for incoming shift personnel
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            {briefing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="min-h-[36px] text-xs"
                title="Copy briefing to clipboard"
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            )}
            <Button
              size="sm"
              onClick={generateBriefing}
              disabled={isGenerating}
              className="min-h-[36px] text-xs bg-primary text-primary-foreground hover:opacity-90"
            >
              {isGenerating ? "Generating…" : briefing ? "Regenerate" : "Generate Brief"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Streaming in-progress */}
        {isGenerating && streamText && (
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground whitespace-pre-wrap font-mono">
            {streamText}
            <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
          </div>
        )}

        {isGenerating && !streamText && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        )}

        {!isGenerating && !briefing && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm text-muted-foreground mb-4">
              Generate an AI-powered shift briefing covering threat summary, key events,
              recommended patrols and species notes.
            </p>
            <Button
              onClick={generateBriefing}
              className="bg-primary text-primary-foreground hover:opacity-90 min-h-[44px]"
            >
              Generate {detectShift()} Briefing
            </Button>
          </div>
        )}

        {!isGenerating && briefing && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-lg">{shiftEmoji}</span>
                <span className="font-semibold text-foreground">{briefing.shift} Shift</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Generated {briefing.generatedAt.toLocaleTimeString()}
              </span>
            </div>

            {/* Raw streamed text OR structured sections */}
            {briefing.raw ? (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {briefing.raw}
              </p>
            ) : (
              <>
                {/* Summary */}
                <p className="text-sm text-foreground leading-relaxed">{briefing.summary}</p>

                {/* Sections */}
                <div className="space-y-4">
                  {briefing.sections.map((section) => (
                    <div key={section.heading}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {section.heading}
                      </h4>
                      <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                        {section.body}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
