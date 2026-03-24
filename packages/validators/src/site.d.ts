import { z } from "zod";
export declare const siteSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    latitude: number;
    longitude: number;
    description?: string | undefined;
    address?: string | undefined;
}, {
    organizationId: string;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    latitude: number;
    longitude: number;
    description?: string | undefined;
    address?: string | undefined;
}>;
export declare const createSiteSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "organizationId" | "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    name: string;
    latitude: number;
    longitude: number;
    description?: string | undefined;
    address?: string | undefined;
}, {
    name: string;
    latitude: number;
    longitude: number;
    description?: string | undefined;
    address?: string | undefined;
}>;
export declare const updateSiteSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    address?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    address?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
}>;
export type Site = z.infer<typeof siteSchema>;
export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
//# sourceMappingURL=site.d.ts.map