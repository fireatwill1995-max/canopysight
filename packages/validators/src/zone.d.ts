import { z } from "zod";
export declare const zoneTypeSchema: z.ZodEnum<["crossing", "approach", "exclusion", "custom"]>;
export declare const pointSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
}, {
    x: number;
    y: number;
}>;
export declare const zoneSchema: z.ZodObject<{
    id: z.ZodString;
    siteId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["crossing", "approach", "exclusion", "custom"]>;
    points: z.ZodArray<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>, "many">;
    cameraId: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    sensitivity: z.ZodDefault<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    type: "custom" | "crossing" | "approach" | "exclusion";
    siteId: string;
    isActive: boolean;
    points: {
        x: number;
        y: number;
    }[];
    sensitivity: number;
    metadata?: Record<string, unknown> | undefined;
    cameraId?: string | undefined;
}, {
    organizationId: string;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    type: "custom" | "crossing" | "approach" | "exclusion";
    siteId: string;
    points: {
        x: number;
        y: number;
    }[];
    isActive?: boolean | undefined;
    metadata?: Record<string, unknown> | undefined;
    cameraId?: string | undefined;
    sensitivity?: number | undefined;
}>;
export declare const createZoneSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    siteId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["crossing", "approach", "exclusion", "custom"]>;
    points: z.ZodArray<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>, "many">;
    cameraId: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    sensitivity: z.ZodDefault<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "organizationId" | "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    name: string;
    type: "custom" | "crossing" | "approach" | "exclusion";
    siteId: string;
    isActive: boolean;
    points: {
        x: number;
        y: number;
    }[];
    sensitivity: number;
    metadata?: Record<string, unknown> | undefined;
    cameraId?: string | undefined;
}, {
    name: string;
    type: "custom" | "crossing" | "approach" | "exclusion";
    siteId: string;
    points: {
        x: number;
        y: number;
    }[];
    isActive?: boolean | undefined;
    metadata?: Record<string, unknown> | undefined;
    cameraId?: string | undefined;
    sensitivity?: number | undefined;
}>;
export declare const updateZoneSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["crossing", "approach", "exclusion", "custom"]>>;
    siteId: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    points: z.ZodOptional<z.ZodArray<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>, "many">>;
    cameraId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sensitivity: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    type?: "custom" | "crossing" | "approach" | "exclusion" | undefined;
    siteId?: string | undefined;
    isActive?: boolean | undefined;
    metadata?: Record<string, unknown> | undefined;
    points?: {
        x: number;
        y: number;
    }[] | undefined;
    cameraId?: string | undefined;
    sensitivity?: number | undefined;
}, {
    name?: string | undefined;
    type?: "custom" | "crossing" | "approach" | "exclusion" | undefined;
    siteId?: string | undefined;
    isActive?: boolean | undefined;
    metadata?: Record<string, unknown> | undefined;
    points?: {
        x: number;
        y: number;
    }[] | undefined;
    cameraId?: string | undefined;
    sensitivity?: number | undefined;
}>;
export type Zone = z.infer<typeof zoneSchema>;
export type ZoneType = z.infer<typeof zoneTypeSchema>;
export type Point = z.infer<typeof pointSchema>;
export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
//# sourceMappingURL=zone.d.ts.map