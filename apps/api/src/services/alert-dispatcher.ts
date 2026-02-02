import { prisma } from "@canopy-sight/database";
import { logger } from "@canopy-sight/config";

/**
 * Multi-channel alert dispatcher
 * Sends alerts via WebSocket, SMS, Email, Push notifications
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
}

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
          ...(alert.severity && {
            OR: [
              { severity: alert.severity },
              { severity: null }, // All severities
            ],
          }),
          OR: [
            { siteIds: { isEmpty: true } }, // All sites
            { siteIds: { has: alert.siteId } }, // Specific site
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

  /**
   * Send SMS via Twilio
   */
  private async sendSMS(alert: AlertData, config: Record<string, unknown>): Promise<void> {
    // TODO: Implement Twilio SMS
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: `${alert.severity.toUpperCase()}: ${alert.title} - ${alert.message}`,
    //   to: config.phoneNumber,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    // });
    logger.debug("SMS notification (not implemented)", {
      phoneNumber: config.phoneNumber,
      alertId: alert.alertId,
      title: alert.title,
    });
  }

  /**
   * Send Email via SendGrid/Resend
   */
  private async sendEmail(alert: AlertData, config: Record<string, unknown>): Promise<void> {
    // TODO: Implement email sending
    // Using Resend or SendGrid
    logger.debug("Email notification (not implemented)", {
      email: config.email,
      alertId: alert.alertId,
      title: alert.title,
    });
  }

  /**
   * Send Push notification via FCM
   */
  private async sendPushNotification(alert: AlertData, config: Record<string, unknown>): Promise<void> {
    // TODO: Implement FCM push notifications
    logger.debug("Push notification (not implemented)", {
      deviceToken: config.deviceToken,
      alertId: alert.alertId,
      title: alert.title,
    });
  }

  /**
   * Send Webhook
   */
  private async sendWebhook(alert: AlertData, config: Record<string, unknown>): Promise<void> {
    try {
      const webhookUrl = config.url as string;
      if (!webhookUrl) {
        throw new Error("Webhook URL not configured");
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.headers as Record<string, string> || {}),
        },
        body: JSON.stringify({
          alert: {
            id: alert.alertId,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            siteId: alert.siteId,
            deviceId: alert.deviceId,
            timestamp: alert.timestamp.toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }

      logger.info("Webhook notification sent", {
        webhookUrl,
        alertId: alert.alertId,
        status: response.status,
      });
    } catch (error) {
      logger.error("Webhook error", error, {
        webhookUrl: config?.url,
        alertId: alert.alertId,
      });
      throw error;
    }
  }
}

export const alertDispatcher = new AlertDispatcher();
