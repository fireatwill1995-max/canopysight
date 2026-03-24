import { z } from "zod";
export declare const detectionTypeSchema: z.ZodEnum<["person", "vehicle", "animal", "unknown"]>;
export declare const detectionEventSchema: z.ZodObject<{
    id: z.ZodString;
    deviceId: z.ZodString;
    siteId: z.ZodString;
    type: z.ZodEnum<["person", "vehicle", "animal", "unknown"]>;
    confidence: z.ZodNumber;
    timestamp: z.ZodDate;
    boundingBox: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        width: number;
        height: number;
    }, {
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    zoneIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    riskScore: z.ZodOptional<z.ZodNumber>;
    videoClipId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
    id: string;
    createdAt: Date;
    type: "unknown" | "person" | "vehicle" | "animal";
    deviceId: string;
    siteId: string;
    confidence: number;
    timestamp: Date;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    riskScore?: number | undefined;
    zoneIds?: string[] | undefined;
    videoClipId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    organizationId: string;
    id: string;
    createdAt: Date;
    type: "unknown" | "person" | "vehicle" | "animal";
    deviceId: string;
    siteId: string;
    confidence: number;
    timestamp: Date;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    riskScore?: number | undefined;
    zoneIds?: string[] | undefined;
    videoClipId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const createDetectionEventSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    deviceId: z.ZodString;
    siteId: z.ZodString;
    type: z.ZodEnum<["person", "vehicle", "animal", "unknown"]>;
    confidence: z.ZodNumber;
    timestamp: z.ZodDate;
    boundingBox: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        width: number;
        height: number;
    }, {
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    zoneIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    riskScore: z.ZodOptional<z.ZodNumber>;
    videoClipId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
}, "organizationId" | "id" | "createdAt">, "strip", z.ZodTypeAny, {
    type: "unknown" | "person" | "vehicle" | "animal";
    deviceId: string;
    siteId: string;
    confidence: number;
    timestamp: Date;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    riskScore?: number | undefined;
    zoneIds?: string[] | undefined;
    videoClipId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    type: "unknown" | "person" | "vehicle" | "animal";
    deviceId: string;
    siteId: string;
    confidence: number;
    timestamp: Date;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    riskScore?: number | undefined;
    zoneIds?: string[] | undefined;
    videoClipId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const detectionListQuerySchema: z.ZodObject<{
    siteId: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    types: z.ZodOptional<z.ZodArray<z.ZodEnum<["person", "vehicle", "animal", "unknown"]>, "many">>;
    minRiskScore: z.ZodOptional<z.ZodNumber>;
    zones: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    limit: z.ZodDefault<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
    zones?: string[] | undefined;
    deviceId?: string | undefined;
    siteId?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    types?: ("unknown" | "person" | "vehicle" | "animal")[] | undefined;
    minRiskScore?: number | undefined;
}, {
    cursor?: string | undefined;
    zones?: string[] | undefined;
    deviceId?: string | undefined;
    siteId?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    types?: ("unknown" | "person" | "vehicle" | "animal")[] | undefined;
    minRiskScore?: number | undefined;
    limit?: number | undefined;
}>;
export type DetectionEvent = z.infer<typeof detectionEventSchema>;
export type DetectionType = z.infer<typeof detectionTypeSchema>;
export type CreateDetectionEventInput = z.infer<typeof createDetectionEventSchema>;
export type DetectionListQuery = z.infer<typeof detectionListQuerySchema>;
//# sourceMappingURL=detection.d.ts.map