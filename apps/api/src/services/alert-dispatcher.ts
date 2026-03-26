import { prisma } from "@canopy-sight/database";
import { logger } from "@canopy-sight/config";

/**
 * Multi-channel alert dispatcher
 * Sends alerts via WebSocket, SMS (Twilio), Email (Resend/SMTP), Push, Webhook
 */
interface WebSocketServer {
  broadcastAlert: (organizationId: string, alert: {
    id: string;
    severity: string;
    title: string;
    message: string;
    siteId: string;
    timestamp: Date;
  }) => void;
}

interface AlertData {
  alertId: string;
  organizationId: string;
  severity: "advisory" | "warning" | "critical";
  title: string;
  message: string;
  siteId: string;
  deviceId?: string;
  timestamp: Date;
  // Optional enrichment fields for email HTML
  detectionType?: string;
  confidence?: number;
  latitude?: number;
  longitude?: number;
}

// ---------------------------------------------------------------------------
// HTML email generator
// ---------------------------------------------------------------------------

function generateEmailHTML(alert: AlertData): string {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const severityStyles: Record<string, { bg: string; border: string; text: string; label: string }> = {
    critical: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b", label: "CRITICAL" },
    warning:  { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", label: "WARNING"  },
    advisory: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", label: "ADVISORY" },
  };

  const style = severityStyles[alert.severity] ?? severityStyles.advisory;
  const ts = new Date(alert.timestamp).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "UTC",
  });

  const coordsSection = (alert.latitude != null && alert.longitude != null)
    ? `
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px;font-weight:600;width:140px">Coordinates</td>
        <td style="padding:6px 0;color:#111827;font-size:14px">${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px;font-weight:600">Map Link</td>
        <td style="padding:6px 0;font-size:14px">
          <a href="https://www.google.com/maps?q=${alert.latitude},${alert.longitude}"
             style="color:#3b82f6;text-decoration:underline">View on Google Maps</a>
        </td>
      </tr>`
    : "";

  const detectionSection = alert.detectionType
    ? `
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px;font-weight:600;width:140px">Detection Type</td>
        <td style="padding:6px 0;color:#111827;font-size:14px">${alert.detectionType}</td>
      </tr>
      ${alert.confidence != null ? `
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px;font-weight:600">Confidence</td>
        <td style="padding:6px 0;color:#111827;font-size:14px">${(alert.confidence * 100).toFixed(1)}%</td>
      </tr>` : ""}`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Canopy Sight Alert</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07)">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:24px 32px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#22d3ee;font-size:20px;font-weight:700;letter-spacing:-0.5px">Canopy Sight</span>
                    <span style="color:#64748b;font-size:14px;margin-left:8px">Wildlife Surveillance Platform</span>
                  </td>
                  <td align="right">
                    <span style="background:${style.bg};color:${style.text};border:1.5px solid ${style.border};
                      border-radius:6px;padding:4px 12px;font-size:13px;font-weight:700;letter-spacing:0.5px">
                      ${style.label}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Severity banner -->
          <tr>
            <td style="background:${style.bg};border-bottom:3px solid ${style.border};padding:16px 32px">
              <p style="margin:0;font-size:18px;font-weight:700;color:${style.text}">${alert.title}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px">
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6">${alert.message}</p>

              <!-- Details table -->
              <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb">
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:14px;font-weight:600;width:140px">Alert ID</td>
                  <td style="padding:6px 0;color:#111827;font-size:14px;font-family:monospace">${alert.alertId}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:14px;font-weight:600">Timestamp</td>
                  <td style="padding:6px 0;color:#111827;font-size:14px">${ts} UTC</td>
                </tr>
                ${detectionSection}
                ${coordsSection}
              </table>

              <!-- CTA button -->
              <div style="margin-top:28px;text-align:center">
                <a href="${frontendUrl}/alerts/${alert.alertId}"
                   style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;
                     padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.2px">
                  View Alert in Dashboard &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center">
              <p style="margin:0;color:#9ca3af;font-size:12px">
                You are receiving this because you have alert notifications enabled for this organisation.<br/>
                &copy; ${new Date().getFullYear()} Canopy Sight &mdash; Wildlife Infrastructure Intelligence
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// AlertDispatcher
// ---------------------------------------------------------------------------

export class AlertDispatcher {
  private wsServer: WebSocketServer | null = null;

  /**
   * Set WebSocket server instance
   */
  setWebSocketServer(wsServer: WebSocketServer): void {
    this.wsServer = wsServer;
  }

  /**
   * Dispatch alert through all configured channels
   */
  async dispatch(alert: AlertData): Promise<void> {
    try {
      // Get notification preferences for this organization
      const preferences = await prisma.notificationPreference.findMany({
        where: {
          organizationId: alert.organizationId,
          isActive: true,
          AND: [
            {
              OR: [
                { severity: alert.severity },
                { severity: null },
              ],
            },
            {
              OR: [
                { siteIds: { isEmpty: true } },
                { siteIds: { has: alert.siteId } },
              ],
            },
          ],
        },
      });

      // Always broadcast via WebSocket for real-time dashboard updates
      if (this.wsServer) {
        this.wsServer.broadcastAlert(alert.organizationId, {
          id: alert.alertId,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          siteId: alert.siteId,
          timestamp: alert.timestamp,
        });
      }

      // Dispatch via configured channels
      const dispatchPromises = preferences.map((pref: { channel: string; config: unknown }) =>
        this.dispatchToChannel(pref.channel, alert, (pref.config as Record<string, unknown>) || {})
      );

      await Promise.allSettled(dispatchPromises);
      logger.info("Alert dispatched", {
        alertId: alert.alertId,
        organizationId: alert.organizationId,
        severity: alert.severity,
        channels: preferences.length,
      });
    } catch (error) {
      logger.error("Error dispatching alert", error, {
        alertId: alert.alertId,
        organizationId: alert.organizationId,
      });
      // Don't throw - alert is already created in DB
    }
  }

  /**
   * Dispatch to specific channel
   */
  private async dispatchToChannel(
    channel: string,
    alert: AlertData,
    config: Record<string, unknown>
  ): Promise<void> {
    try {
      switch (channel) {
        case "sms":
          await this.sendSMS(alert, config);
          break;
        case "email":
          await this.sendEmail(alert, config);
          break;
        case "push":
          await this.sendPushNotification(alert, config);
          break;
        case "webhook":
          await this.sendWebhook(alert, config);
          break;
        default:
          logger.warn("Unknown notification channel", { channel, alertId: alert.alertId });
      }
    } catch (error) {
      logger.error(`Error sending ${channel} notification`, error, {
        channel,
        alertId: alert.alertId,
      });
      // Log but don't throw - other channels may succeed
    }
  }

  // ---------------------------------------------------------------------------
  // SMS via Twilio REST API (no extra package required)
  // ---------------------------------------------------------------------------

  private async sendSMS(alert: AlertData, config: Record<string, unknown>): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken   = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber  = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      logger.warn("Twilio env vars not configured — skipping SMS", {
        alertId: alert.alertId,
        missing: [
          !accountSid  && "TWILIO_ACCOUNT_SID",
          !authToken   && "TWILIO_AUTH_TOKEN",
          !fromNumber  && "TWILIO_FROM_NUMBER",
        ].filter(Boolean),
      });
      return;
    }

    const phoneNumber = config.phoneNumber;
    if (typeof phoneNumber !== "string" || !phoneNumber) {
      logger.warn("SMS config missing phoneNumber", { alertId: alert.alertId });
      return;
    }

    const body =
      `[${alert.severity.toUpperCase()}] Canopy Sight Alert\n` +
      `${alert.title}\n` +
      `${alert.message}\n` +
      `View: ${process.env.FRONTEND_URL || "https://app.canopysight.com"}/alerts/${alert.alertId}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To:   phoneNumber,
          Body: body,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Twilio SMS failed (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as { sid?: string };
    logger.info("SMS sent via Twilio", {
      alertId: alert.alertId,
      to: phoneNumber,
      sid: result.sid,
    });
  }

  // ---------------------------------------------------------------------------
  // Email via Resend (primary) with SMTP fallback
  // ---------------------------------------------------------------------------

  private async sendEmail(alert: AlertData, config: Record<string, unknown>): Promise<void> {
    const email = config.email;
    if (typeof email !== "string" || !email) {
      logger.warn("Email config missing email address", { alertId: alert.alertId });
      return;
    }

    const html    = generateEmailHTML(alert);
    const subject = `[${alert.severity.toUpperCase()}] Alert: ${alert.title}`;

    // ---- Try Resend first ----
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "alerts@canopysight.com",
          to:   email,
          subject,
          html,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Resend email failed (${response.status}): ${errorText}`);
      }

      const result = (await response.json()) as { id?: string };
      logger.info("Email sent via Resend", {
        alertId: alert.alertId,
        to: email,
        messageId: result.id,
      });
      return;
    }

    // ---- SMTP fallback (nodemailer-style via raw SMTP is complex without packages;
    //      use a minimal approach with the built-in net module) ----
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      // Dynamically require nodemailer if available (it may be installed as a transitive dep)
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodemailer = require("nodemailer") as typeof import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort, 10),
          secure: parseInt(smtpPort, 10) === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: `"Canopy Sight Alerts" <${smtpUser}>`,
          to: email,
          subject,
          html,
        });

        logger.info("Email sent via SMTP", { alertId: alert.alertId, to: email });
        return;
      } catch (requireErr) {
        logger.warn("nodemailer not available for SMTP fallback", {
          alertId: alert.alertId,
          error: requireErr instanceof Error ? requireErr.message : String(requireErr),
        });
      }
    }

    logger.warn(
      "No email transport configured (set RESEND_API_KEY or SMTP_HOST/PORT/USER/PASS) — skipping email",
      { alertId: alert.alertId }
    );
  }

  // ---------------------------------------------------------------------------
  // Push notification (FCM via HTTP v1 API)
  // ---------------------------------------------------------------------------

  private async sendPushNotification(alert: AlertData, config: Record<string, unknown>): Promise<void> {
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      logger.warn("FCM_SERVER_KEY not configured — skipping push notification", {
        alertId: alert.alertId,
      });
      return;
    }

    const deviceToken = config.deviceToken;
    if (typeof deviceToken !== "string" || !deviceToken) {
      logger.warn("Push config missing deviceToken", { alertId: alert.alertId });
      return;
    }

    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${serverKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: deviceToken,
        notification: {
          title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
          body: alert.message,
          icon: "/icon-192.png",
          click_action: `${process.env.FRONTEND_URL || "https://app.canopysight.com"}/alerts/${alert.alertId}`,
        },
        data: {
          alertId:  alert.alertId,
          severity: alert.severity,
          siteId:   alert.siteId,
        },
        priority: alert.severity === "critical" ? "high" : "normal",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`FCM push failed (${response.status}): ${errorText}`);
    }

    logger.info("Push notification sent via FCM", { alertId: alert.alertId });
  }

  // ---------------------------------------------------------------------------
  // Webhook (unchanged — already fully implemented)
  // ---------------------------------------------------------------------------

  private async sendWebhook(alert: AlertData, config: Record<string, unknown>): Promise<void> {
    try {
      if (typeof config.url !== "string" || !config.url) {
        throw new Error("Webhook URL not configured");
      }
      const webhookUrl = config.url;

      let parsed: URL;
      try {
        parsed = new URL(webhookUrl);
      } catch {
        throw new Error("Invalid webhook URL");
      }

      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("Webhook URL must use HTTP or HTTPS");
      }
      const forbiddenHosts = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "[::1]"];
      const isPrivate172 = parsed.hostname.startsWith("172.") && (() => {
        const second = parseInt(parsed.hostname.split(".")[1], 10);
        return second >= 16 && second <= 31;
      })();
      if (
        forbiddenHosts.includes(parsed.hostname) ||
        parsed.hostname.startsWith("10.") ||
        parsed.hostname.startsWith("192.168.") ||
        isPrivate172
      ) {
        throw new Error("Webhook URL must not point to internal/private addresses");
      }

      const sensitiveHeaders = new Set(["host", "authorization", "cookie", "x-forwarded-for"]);
      const safeHeaders: Record<string, string> = {};
      if (config.headers && typeof config.headers === "object") {
        for (const [key, value] of Object.entries(config.headers as Record<string, string>)) {
          if (!sensitiveHeaders.has(key.toLowerCase()) && typeof value === "string") {
            safeHeaders[key] = value;
          }
        }
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...safeHeaders,
        },
        body: JSON.stringify({
          alert: {
            id:        alert.alertId,
            severity:  alert.severity,
            title:     alert.title,
            message:   alert.message,
            siteId:    alert.siteId,
            deviceId:  alert.deviceId,
            timestamp: alert.timestamp.toISOString(),
          },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }

      logger.info("Webhook notification sent", {
        alertId: alert.alertId,
        status: response.status,
      });
    } catch (error) {
      logger.error("Webhook error", error, { alertId: alert.alertId });
      throw error;
    }
  }
}

export const alertDispatcher = new AlertDispatcher();
