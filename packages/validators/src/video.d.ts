import { z } from "zod";
export declare const videoClipSchema: z.ZodObject<{
    id: z.ZodString;
    detectionEventId: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodString;
    siteId: z.ZodString;
    filePath: z.ZodString;
    thumbnailPath: z.ZodOptional<z.ZodString>;
    duration: z.ZodNumber;
    startTime: z.ZodDate;
    endTime: z.ZodDate;
    fileSize: z.ZodNumber;
    mimeType: z.ZodString;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    duration: number;
    organizationId: string;
    id: string;
    createdAt: Date;
    deviceId: string;
    siteId: string;
    filePath: string;
    startTime: Date;
    endTime: Date;
    fileSize: number;
    mimeType: string;
    detectionEventId?: string | undefined;
    thumbnailPath?: string | undefined;
}, {
    duration: number;
    organizationId: string;
    id: string;
    createdAt: Date;
    deviceId: string;
    siteId: string;
    filePath: string;
    startTime: Date;
    endTime: Date;
    fileSize: number;
    mimeType: string;
    detectionEventId?: string | undefined;
    thumbnailPath?: string | undefined;
}>;
export declare const createVideoClipSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    detectionEventId: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodString;
    siteId: z.ZodString;
    filePath: z.ZodString;
    thumbnailPath: z.ZodOptional<z.ZodString>;
    duration: z.ZodNumber;
    startTime: z.ZodDate;
    endTime: z.ZodDate;
    fileSize: z.ZodNumber;
    mimeType: z.ZodString;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
}, "organizationId" | "id" | "createdAt">, "strip", z.ZodTypeAny, {
    duration: number;
    deviceId: string;
    siteId: string;
    filePath: string;
    startTime: Date;
    endTime: Date;
    fileSize: number;
    mimeType: string;
    detectionEventId?: string | undefined;
    thumbnailPath?: string | undefined;
}, {
    duration: number;
    deviceId: string;
    siteId: string;
    filePath: string;
    startTime: Date;
    endTime: Date;
    fileSize: number;
    mimeType: string;
    detectionEventId?: string | undefined;
    thumbnailPath?: string | undefined;
}>;
export declare const signedUrlSchema: z.ZodObject<{
    url: z.ZodString;
    expiresAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    url: string;
    expiresAt: Date;
}, {
    url: string;
    expiresAt: Date;
}>;
export type VideoClip = z.infer<typeof videoClipSchema>;
export type CreateVideoClipInput = z.infer<typeof createVideoClipSchema>;
export type SignedUrl = z.infer<typeof signedUrlSchema>;
//# sourceMappingURL=video.d.ts.map