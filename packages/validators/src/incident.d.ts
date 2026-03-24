import { z } from "zod";
/** Contributing conditions for incident reconstruction & learning */
export declare const contributingConditionsSchema: z.ZodOptional<z.ZodObject<{
    crowding: z.ZodOptional<z.ZodBoolean>;
    crowdingLevel: z.ZodOptional<z.ZodNumber>;
    zoneIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    layoutNotes: z.ZodOptional<z.ZodString>;
    timeOfDay: z.ZodOptional<z.ZodString>;
    hourOfDay: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    zoneIds?: string[] | undefined;
    crowding?: boolean | undefined;
    crowdingLevel?: number | undefined;
    layoutNotes?: string | undefined;
    timeOfDay?: string | undefined;
    hourOfDay?: number | undefined;
}, {
    zoneIds?: string[] | undefined;
    crowding?: boolean | undefined;
    crowdingLevel?: number | undefined;
    layoutNotes?: string | undefined;
    timeOfDay?: string | undefined;
    hourOfDay?: number | undefined;
}>>;
export declare const createIncidentSchema: z.ZodObject<{
    siteId: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    reportedBy: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    contributingConditions: z.ZodOptional<z.ZodObject<{
        crowding: z.ZodOptional<z.ZodBoolean>;
        crowdingLevel: z.ZodOptional<z.ZodNumber>;
        zoneIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        layoutNotes: z.ZodOptional<z.ZodString>;
        timeOfDay: z.ZodOptional<z.ZodString>;
        hourOfDay: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        zoneIds?: string[] | undefined;
        crowding?: boolean | undefined;
        crowdingLevel?: number | undefined;
        layoutNotes?: string | undefined;
        timeOfDay?: string | undefined;
        hourOfDay?: number | undefined;
    }, {
        zoneIds?: string[] | undefined;
        crowding?: boolean | undefined;
        crowdingLevel?: number | undefined;
        layoutNotes?: string | undefined;
        timeOfDay?: string | undefined;
        hourOfDay?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    description: string;
    siteId: string;
    severity: "critical" | "low" | "medium" | "high";
    title: string;
    metadata?: Record<string, unknown> | undefined;
    reportedBy?: string | undefined;
    contributingConditions?: {
        zoneIds?: string[] | undefined;
        crowding?: boolean | undefined;
        crowdingLevel?: number | undefined;
        layoutNotes?: string | undefined;
        timeOfDay?: string | undefined;
        hourOfDay?: number | undefined;
    } | undefined;
}, {
    description: string;
    siteId: string;
    severity: "critical" | "low" | "medium" | "high";
    title: string;
    metadata?: Record<string, unknown> | undefined;
    reportedBy?: string | undefined;
    contributingConditions?: {
        zoneIds?: string[] | undefined;
        crowding?: boolean | undefined;
        crowdingLevel?: number | undefined;
        layoutNotes?: string | undefined;
        timeOfDay?: string | undefined;
        hourOfDay?: number | undefined;
    } | undefined;
}>;
export declare const updateIncidentSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    resolvedAt: z.ZodOptional<z.ZodDate>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    contributingConditions: z.ZodOptional<z.ZodObject<{
        crowding: z.ZodOptional<z.ZodBoolean>;
        crowdingLevel: z.ZodOptional<z.ZodNumber>;
        zoneIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        layoutNotes: z.ZodOptional<z.ZodString>;
        timeOfDay: z.ZodOptional<z.ZodString>;
        hourOfDay: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        zoneIds?: string[] | undefined;
        crowding?: boolean | undefined;
        crowdingLevel?: number | undefined;
        layoutNotes?: string | undefined;
        timeOfDay?: string | undefined;
        hourOfDay?: number | undefined;
    }, {
        zoneIds?: string[] | undefined;
        crowding?: boolean | undefined;
        crowdingLevel?: number | undefined;
        layoutNotes?: string | undefined;
        timeOfDay?: string | undefined;
        hourOfDay?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    severity?: "critical" | "low" | "medium" | "high" | undefined;
    title?: string | undefined;
    resolvedAt?: Date | undefined;
    contributingConditions?: {
        zoneIds?: string[] | undefined;
        crowding?: boolean | undefined;
        crowdingLevel?: number | undefined;
        layoutNotes?: string | undefined;
        timeOfDay?: string | undefined;
        hourOfDay?: number | undefined;
    } | undefined;
}, {
    id: string;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    severity?: "critical" | "low" | "medium" | "high" | undefined;
    title?: string | undefined;
    resolvedAt?: Date | undefined;
    contributingConditions?: {
        zoneIds?: string[] | undefined;
        crowding?: boolean | undefined;
        crowdingLevel?: number | undefined;
        layoutNotes?: string | undefined;
        timeOfDay?: string | undefined;
        hourOfDay?: number | undefined;
    } | undefined;
}>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
//# sourceMappingURL=incident.d.ts.map