import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// We test the functions from security-middleware.ts and request-id.ts
// Import after any necessary mocks
import {
  inputSanitizationMiddleware,
  contentTypeValidation,
} from "../security-middleware";
import { requestIdMiddleware } from "../request-id";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    method: "GET",
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response & { statusCode: number; jsonBody: unknown } {
  const res = {
    statusCode: 200,
    jsonBody: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.jsonBody = body;
      return res;
    },
    setHeader: vi.fn(),
  };
  return res as unknown as Response & { statusCode: number; jsonBody: unknown };
}

// ── sanitizeInput (via inputSanitizationMiddleware) ──────────────────────────

describe("inputSanitizationMiddleware", () => {
  it("strips HTML tags from string values in body", () => {
    const req = createMockReq({
      body: { name: "<script>alert('xss')</script>Hello" },
    });
    const next = vi.fn();

    inputSanitizationMiddleware(req, createMockRes() as any, next);

    expect(req.body.name).toBe("alert('xss')Hello");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("handles nested objects recursively", () => {
    const req = createMockReq({
      body: {
        user: {
          name: "<b>Bold</b>",
          profile: {
            bio: "<em>Italic</em> text",
          },
        },
      },
    });
    const next = vi.fn();

    inputSanitizationMiddleware(req, createMockRes() as any, next);

    expect(req.body.user.name).toBe("Bold");
    expect(req.body.user.profile.bio).toBe("Italic text");
  });

  it("handles arrays of strings", () => {
    const req = createMockReq({
      body: { tags: ["<b>tag1</b>", "<i>tag2</i>"] },
    });
    const next = vi.fn();

    inputSanitizationMiddleware(req, createMockRes() as any, next);

    expect(req.body.tags).toEqual(["tag1", "tag2"]);
  });

  it("preserves non-string values unchanged", () => {
    const req = createMockReq({
      body: { count: 42, active: true, data: null },
    });
    const next = vi.fn();

    inputSanitizationMiddleware(req, createMockRes() as any, next);

    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
    expect(req.body.data).toBeNull();
  });

  it("calls next even when body is empty", () => {
    const req = createMockReq({ body: undefined });
    const next = vi.fn();

    inputSanitizationMiddleware(req, createMockRes() as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ── contentTypeValidation ────────────────────────────────────────────────────

describe("contentTypeValidation", () => {
  it("allows GET requests without content-type check", () => {
    const req = createMockReq({ method: "GET" });
    const res = createMockRes();
    const next = vi.fn();

    contentTypeValidation(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("allows POST with application/json content-type", () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "100" },
    });
    const next = vi.fn();

    contentTypeValidation(req, createMockRes() as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows POST with multipart/form-data content-type", () => {
    const req = createMockReq({
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=----abc",
        "content-length": "500",
      },
    });
    const next = vi.fn();

    contentTypeValidation(req, createMockRes() as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects POST with unsupported content-type (e.g., text/xml)", () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "text/xml", "content-length": "100" },
    });
    const res = createMockRes();
    const next = vi.fn();

    contentTypeValidation(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(415);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({ error: "Unsupported Media Type" }),
    );
  });

  it("allows POST with content-length 0 (no body)", () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "text/xml", "content-length": "0" },
    });
    const next = vi.fn();

    contentTypeValidation(req, createMockRes() as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects PUT with bad content-type", () => {
    const req = createMockReq({
      method: "PUT",
      headers: { "content-type": "text/plain", "content-length": "50" },
    });
    const res = createMockRes();
    const next = vi.fn();

    contentTypeValidation(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(415);
  });
});

// ── requestIdMiddleware ──────────────────────────────────────────────────────

describe("requestIdMiddleware", () => {
  it("generates a UUID request ID when none is provided", () => {
    const req = createMockReq({ headers: {} });
    const res = createMockRes();
    const next = vi.fn();

    requestIdMiddleware(req, res as any, next);

    expect(req.requestId).toBeDefined();
    // UUID v4 pattern
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("preserves client-provided X-Request-ID header", () => {
    const clientId = "client-request-abc-123";
    const req = createMockReq({
      headers: { "x-request-id": clientId },
    });
    const res = createMockRes();
    const next = vi.fn();

    requestIdMiddleware(req, res as any, next);

    expect(req.requestId).toBe(clientId);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", clientId);
  });

  it("sets X-Request-ID response header", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    requestIdMiddleware(req, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Request-ID",
      expect.any(String),
    );
  });
});
