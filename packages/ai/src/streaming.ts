/**
 * SSE Streaming helper for LangGraph agent responses
 *
 * Wraps agent execution and yields Server-Sent Events compatible with
 * Next.js ReadableStream and Fastify reply.raw.
 */

import type { StreamEvent, StreamEventType } from "./agents/types";

/**
 * Encode a StreamEvent as an SSE data line.
 */
function formatSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Create a ReadableStream that wraps an async agent execution function,
 * emitting SSE-formatted events as the agent progresses.
 *
 * @param agentName - Name of the agent being executed (for event metadata)
 * @param execute   - Async function that performs the agent work.
 *                    It receives an `emit` callback to push intermediate events.
 * @returns A ReadableStream<Uint8Array> suitable for Response or Fastify.
 */
export function createSSEStream(
  agentName: string,
  execute: (
    emit: (type: StreamEventType, state: string | undefined, data: unknown) => void
  ) => Promise<unknown>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (
        type: StreamEventType,
        state: string | undefined,
        data: unknown
      ) => {
        const event: StreamEvent = {
          type,
          agentName,
          state,
          data,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(encoder.encode(formatSSE(event)));
      };

      // Signal start
      emit("agent:start", undefined, { agentName });

      try {
        const result = await execute(emit);

        // Signal completion
        emit("agent:complete", undefined, result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        emit("agent:error", undefined, { error: errorMessage });
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Wrap a LangGraph compiled graph invocation with SSE streaming.
 *
 * Usage with Next.js App Router:
 * ```ts
 * export async function POST(req: Request) {
 *   const body = await req.json();
 *   const stream = createAgentSSEStream("mission-planner", missionPlannerAgent, body);
 *   return new Response(stream, {
 *     headers: {
 *       "Content-Type": "text/event-stream",
 *       "Cache-Control": "no-cache",
 *       Connection: "keep-alive",
 *     },
 *   });
 * }
 * ```
 */
export function createAgentSSEStream(
  agentName: string,
  agent: { invoke: (input: any) => Promise<any> },
  input: Record<string, unknown>
): ReadableStream<Uint8Array> {
  return createSSEStream(agentName, async (emit) => {
    emit("agent:state_change", "invoking", { input: Object.keys(input) });

    const result = await agent.invoke(input);

    emit("agent:state_change", "complete", {
      outputKeys: Object.keys(result ?? {}),
    });

    return result;
  });
}
