import { z } from 'zod'

// Format enum
export const nodeFormatSchema = z.enum(['hash', 'json', 'xml', 'ai_json'])

// Parse / detect format
export const detectFormatRequestSchema = z.object({
    input: z.string().min(1, 'Input is required').max(100_000, 'Input too large (max 100 KB)'),
})

export const detectFormatResponseSchema = z.object({
    format: nodeFormatSchema,
    confidence: z.number().min(0).max(1),
})

// Validate
export const validateRequestSchema = z.object({
    input: z.string().min(1).max(100_000),
    format: nodeFormatSchema.optional(),
})

export const validateResponseSchema = z.object({
    valid: z.boolean(),
    format: nodeFormatSchema,
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
})

// Convert
export const convertRequestSchema = z.object({
    input: z.string().min(1).max(100_000),
    sourceFormat: nodeFormatSchema.optional(),
    targetFormat: nodeFormatSchema,
})

export const convertResponseSchema = z.object({
    output: z.string(),
    sourceFormat: nodeFormatSchema,
    targetFormat: nodeFormatSchema,
})

// Inspect
export const inspectRequestSchema = z.object({
    input: z.string().min(1).max(100_000),
    format: nodeFormatSchema.optional(),
})

// Diff
export const diffRequestSchema = z.object({
    left: z.string().min(1).max(100_000),
    right: z.string().min(1).max(100_000),
    leftFormat: nodeFormatSchema.optional(),
    rightFormat: nodeFormatSchema.optional(),
})

// Share — strict limits per requirements
export const createShareRequestSchema = z.object({
    title: z.string().min(1).max(120).transform(s => s.trim()),
    description: z.string().max(1000).default('').transform(s => s.trim()),
    content: z.string().min(1).max(100_000),
    format: nodeFormatSchema,
    isPublic: z.boolean().default(false),
    tags: z.array(z.string().max(30)).max(10).default([]),
    images: z.array(z.string().max(3_000_000, 'Image too large (max ~2 MB)')).max(4, 'Maximum 4 images allowed').default([]),
})

export const shareResponseSchema = z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    sourceFormat: nodeFormatSchema,
    originalContent: z.string(),
    isPublic: z.boolean(),
    tags: z.array(z.string()),
    createdAt: z.string(),
    updatedAt: z.string(),
})

// Infer types from schemas
export type DetectFormatRequest = z.infer<typeof detectFormatRequestSchema>
export type DetectFormatResponse = z.infer<typeof detectFormatResponseSchema>
export type ValidateRequest = z.infer<typeof validateRequestSchema>
export type ValidateResponse = z.infer<typeof validateResponseSchema>
export type ConvertRequest = z.infer<typeof convertRequestSchema>
export type ConvertResponse = z.infer<typeof convertResponseSchema>
export type InspectRequest = z.infer<typeof inspectRequestSchema>
export type DiffRequest = z.infer<typeof diffRequestSchema>
export type CreateShareRequest = z.infer<typeof createShareRequestSchema>
export type ShareResponse = z.infer<typeof shareResponseSchema>
