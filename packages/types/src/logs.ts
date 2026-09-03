import { z } from "zod";

export interface RequestLogEntry {
    id: string;
    apiKeyId?: string;
    providerId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    statusCode: number;
    latencyMs: number;
    cachedTokens?: number;
    cacheCreationTokens?: number;
    reasoningTokens?: number;
    estimatedCost?: number;
    fallbackOccurred?: boolean;
    fallbackPath?: string;
    fallbackReason?: string;
    resolvedModel?: string;
    createdAt: number;
}

export interface UsageSummary {
    totalRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCachedTokens: number;
    totalCacheCreationTokens: number;
    totalReasoningTokens: number;
    totalEstimatedCost: number;
    // 9router-style aliases
    totalInputTokens: number;
    totalOutputTokens: number;
}

export interface UsageByModelRow {
    model: string;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    estCost: number;
}

export interface ModelUsageSummaryRow {
    model: string;
    providerId?: string;
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    estimatedCost: number;
    lastUsedAt: number | null;
}

export interface UsagePeriodStats {
    period: string;
    totalRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCachedTokens: number;
    totalCost: number;
    byModel: ModelUsageSummaryRow[];
    byProvider: Array<{
        providerId: string;
        totalRequests: number;
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
        cachedTokens: number;
        estimatedCost: number;
        lastUsedAt: number | null;
    }>;
    byApiKey: Array<{
        apiKeyId: string | null;
        apiKeyName?: string;
        totalRequests: number;
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
        cachedTokens: number;
        estimatedCost: number;
        lastUsedAt: number | null;
    }>;
    chartData: Array<{
        label: string;
        timestamp?: number;
        tokens: number;
        cost: number;
        requests: number;
    }>;
}

export interface RequestDetailItem {
    id: string;
    timestamp: number;
    model: string;
    providerId: string;
    apiKeyId?: string | null;
    apiKeyName?: string;
    statusCode: number;
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    cacheCreationTokens: number;
    reasoningTokens: number;
    totalTokens: number;
    estimatedCost: number;
    fallbackOccurred: boolean;
    fallbackPath?: string | null;
    fallbackReason?: string | null;
    resolvedModel?: string | null;
}

export interface RequestDetailsResponse {
    details: RequestDetailItem[];
    pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
    };
}

export interface UsageStats extends UsageSummary {
    object: "usage";
    costLabel: string;
    estimated: boolean;
    byModel: UsageByModelRow[];
}

// --- Analytics ---

export type AnalyticsWindow = "1h" | "24h" | "7d" | "30d";

export interface AnalyticsBucket {
    bucketStart: number; // epoch ms, aligned to bucket size
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    avgLatencyMs: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
}

export interface AnalyticsTopModel {
    model: string;
    totalRequests: number;
    totalTokens: number;
    estCost: number;
}

export interface AnalyticsProviderSlice {
    providerId: string;
    totalRequests: number;
}

export interface AnalyticsReport {
    object: "analytics";
    window: AnalyticsWindow;
    bucketSizeMs: number;
    generatedAt: number;
    requestsPerSecond: number; // rolling 60s average
    totalRequests: number;
    errorRate: number; // 0..1 over the window
    p95LatencyMs: number;
    buckets: AnalyticsBucket[];
    topModels: AnalyticsTopModel[];
    providers: AnalyticsProviderSlice[];
}

export const AnalyticsQuerySchema = z.object({
    window: z.enum(["1h", "24h", "7d", "30d"]).default("24h")
});
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
