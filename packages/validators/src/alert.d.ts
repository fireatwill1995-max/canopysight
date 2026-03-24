import { z } from "zod";
export declare const alertSeveritySchema: z.ZodEnum<["advisory", "warning", "critical"]>;
export declare const alertStatusSchema: z.ZodEnum<["active", "acknowledged", "resolved", "dismissed"]>;
export declare const alertSchema: z.ZodObject<{
    id: z.ZodString;
    detectionEventId: z.ZodOptional<z.ZodString>;
    siteId: z.ZodString;
    deviceId: z.ZodOptional<z.ZodString>;
    severity: z.ZodEnum<["advisory", "warning", "critical"]>;
    status: z.ZodEnum<["active", "acknowledged", "resolved", "dismissed"]>;
    title: z.ZodString;
    message: z.ZodString;
    acknowledgedBy: z.ZodOptional<z.ZodString>;
    acknowledgedAt: z.ZodOptional<z.ZodDate>;
    resolvedAt: z.ZodOptional<z.ZodDate>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    message: string;
    status: "active" | "acknowledged" | "resolved" | "dismissed";
    siteId: string;
    severity: "advisory" | "warning" | "critical";
    title: string;
    deviceId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    detectionEventId?: string | undefined;
    acknowledgedBy?: string | undefined;
    acknowledgedAt?: Date | undefined;
    resolvedAt?: Date | undefined;
}, {
    organizationId: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    message: string;
    status: "active" | "acknowledged" | "resolved" | "dismissed";
    siteId: string;
    severity: "advisory" | "warning" | "critical";
    title: string;
    deviceId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    detectionEventId?: string | undefined;
    acknowledgedBy?: string | undefined;
    acknowledgedAt?: Date | undefined;
    resolvedAt?: Date | undefined;
}>;
export declare const createAlertSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    detectionEventId: z.ZodOptional<z.ZodString>;
    siteId: z.ZodString;
    deviceId: z.ZodOptional<z.ZodString>;
    severity: z.ZodEnum<["advisory", "warning", "critical"]>;
    status: z.ZodEnum<["active", "acknowledged", "resolved", "dismissed"]>;
    title: z.ZodString;
    message: z.ZodString;
    acknowledgedBy: z.ZodOptional<z.ZodString>;
    acknowledgedAt: z.ZodOptional<z.ZodDate>;
    resolvedAt: z.ZodOptional<z.ZodDate>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "organizationId" | "id" | "createdAt" | "updatedAt" | "acknowledgedBy" | "acknowledgedAt" | "resolvedAt">, "strip", z.ZodTypeAny, {
    message: string;
    status: "active" | "acknowledged" | "resolved" | "dismissed";
    siteId: string;
    severity: "advisory" | "warning" | "critical";
    title: string;
    deviceId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    detectionEventId?: string | undefined;
}, {
    message: string;
    status: "active" | "acknowledged" | "resolved" | "dismissed";
    siteId: string;
    severity: "advisory" | "warning" | "critical";
    title: string;
    deviceId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    detectionEventId?: string | undefined;
}>;
export declare const updateAlertSchema: z.ZodObject<{
    message: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    siteId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    detectionEventId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    severity: z.ZodOptional<z.ZodEnum<["advisory", "warning", "critical"]>>;
    title: z.ZodOptional<z.ZodString>;
} & {
    status: z.ZodOptional<z.ZodEnum<["active", "acknowledged", "resolved", "dismissed"]>>;
}, "strip", z.ZodTypeAny, {
    message?: string | undefined;
    status?: "active" | "acknowledged" | "resolved" | "dismissed" | undefined;
    deviceId?: string | undefined;
    siteId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    detectionEventId?: string | undefined;
    severity?: "advisory" | "warning" | "critical" | undefined;
    title?: string | undefined;
}, {
    message?: string | undefined;
    status?: "active" | "acknowledged" | "resolved" | "dismissed" | undefined;
    deviceId?: string | undefined;
    siteId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    detectionEventId?: string | undefined;
    severity?: "advisory" | "warning" | "critical" | undefined;
    title?: string | undefined;
}>;
export declare const alertSubscriptionSchema: z.ZodObject<{
    siteIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    minSeverity: z.ZodOptional<z.ZodEnum<["advisory", "warning", "critical"]>>;
}, "strip", z.ZodTypeAny, {
    siteIds?: string[] | undefined;
    minSeverity?: "advisory" | "warning" | "critical" | undefined;
}, {
    siteIds?: string[] | undefined;
    minSeverity?: "advisory" | "warning" | "critical" | undefined;
}>;
export type Alert = z.infer<typeof alertSchema>;
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;
export type AlertStatus = z.infer<typeof alertStatusSchema>;
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;
export type AlertSubscription = z.infer<typeof alertSubscriptionSchema>;
//# sourceMappingURL=alert.d.ts.map