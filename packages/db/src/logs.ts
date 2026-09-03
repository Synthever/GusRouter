import type {
    AnalyticsWindow,
    ModelUsageSummaryRow,
    RequestLogEntry,
    UsageByModelRow,
    UsageSummary
} from "@srouter/types";
import { db } from "./db.js";
import { generateId, num, optStr, str } from "./row-utils.js";

interface RequestLogRow {
    id: string;
    api_key_id: string | null;
    provider_id: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    status_code: number;
    latency_ms: number;
    cached_tokens: number;
    cache_creation_tokens: number;
    reasoning_tokens: number;
    estimated_cost: number;
    fallback_occurred: number;
    fallback_path: string | null;
    fallback_reason: string | null;
    resolved_model: string | null;
    created_at: number;
}

interface UsageSummaryRow {
    totalRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCachedTokens: number;
    totalCacheCreationTokens: number;
    totalReasoningTokens: number;
    totalEstimatedCost: number;
}

interface ModelUsageDBShape {
    model: string;
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    estimatedCost: number;
    lastUsedAt: number | null;
}

interface UsageByModelDBShape {
    model: string;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    estCost: number;
}

export function logRequestDB(entry: Omit<RequestLogEntry, "id" | "createdAt">): RequestLogEntry {
    const Id = generateId("log");
    const CreatedAt = Date.now();

    const Query = db.prepare(`
        INSERT INTO request_logs (id, api_key_id, provider_id, model, prompt_tokens, completion_tokens, total_tokens, status_code, latency_ms, cached_tokens, cache_creation_tokens, reasoning_tokens, estimated_cost, fallback_occurred, fallback_path, fallback_reason, resolved_model, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    Query.run(
        Id,
        entry.apiKeyId ?? null,
        entry.providerId,
        entry.model,
        entry.promptTokens,
        entry.completionTokens,
        entry.totalTokens,
        entry.statusCode,
        entry.latencyMs,
        entry.cachedTokens ?? 0,
        entry.cacheCreationTokens ?? 0,
        entry.reasoningTokens ?? 0,
        entry.estimatedCost ?? 0,
        entry.fallbackOccurred ? 1 : 0,
        entry.fallbackPath ?? null,
        entry.fallbackReason ?? null,
        entry.resolvedModel ?? null,
        CreatedAt
    );

    return {
        id: Id,
        ...entry,
        createdAt: CreatedAt
    };
}

export function getRecentLogsDB(limit = 50): RequestLogEntry[] {
    const Query = db.prepare("SELECT * FROM request_logs ORDER BY created_at DESC LIMIT ?");
    const Rows = Query.all(limit) as unknown as RequestLogRow[];

    return Rows.map(mapLogRow);
}

export function getUsageSummaryDB(): UsageSummary {
    const Query = db.prepare(`
        SELECT 
            COUNT(*) as totalRequests,
            COALESCE(SUM(total_tokens), 0) as totalTokens,
            COALESCE(SUM(prompt_tokens), 0) as totalPromptTokens,
            COALESCE(SUM(completion_tokens), 0) as totalCompletionTokens,
            COALESCE(SUM(cached_tokens), 0) as totalCachedTokens,
            COALESCE(SUM(cache_creation_tokens), 0) as totalCacheCreationTokens,
            COALESCE(SUM(reasoning_tokens), 0) as totalReasoningTokens,
            COALESCE(SUM(estimated_cost), 0) as totalEstimatedCost
        FROM request_logs
    `);

    const Result = Query.get() as unknown as UsageSummaryRow | undefined;

    return {
        totalRequests: num(Result?.totalRequests),
        totalTokens: num(Result?.totalTokens),
        totalPromptTokens: num(Result?.totalPromptTokens),
        totalCompletionTokens: num(Result?.totalCompletionTokens),
        totalCachedTokens: num(Result?.totalCachedTokens),
        totalCacheCreationTokens: num(Result?.totalCacheCreationTokens),
        totalReasoningTokens: num(Result?.totalReasoningTokens),
        totalEstimatedCost: num(Result?.totalEstimatedCost),
        totalInputTokens: num(Result?.totalPromptTokens),
        totalOutputTokens: num(Result?.totalCompletionTokens)
    };
}

export function getProviderUsageSummaryDB(providerId: string): UsageSummary {
    const Query = db.prepare(`
        SELECT 
            COUNT(*) as totalRequests,
            COALESCE(SUM(total_tokens), 0) as totalTokens,
            COALESCE(SUM(prompt_tokens), 0) as totalPromptTokens,
            COALESCE(SUM(completion_tokens), 0) as totalCompletionTokens,
            COALESCE(SUM(cached_tokens), 0) as totalCachedTokens,
            COALESCE(SUM(cache_creation_tokens), 0) as totalCacheCreationTokens,
            COALESCE(SUM(reasoning_tokens), 0) as totalReasoningTokens,
            COALESCE(SUM(estimated_cost), 0) as totalEstimatedCost
        FROM request_logs
        WHERE provider_id = ?
    `);

    const Result = Query.get(providerId) as unknown as UsageSummaryRow | undefined;

    return {
        totalRequests: num(Result?.totalRequests),
        totalTokens: num(Result?.totalTokens),
        totalPromptTokens: num(Result?.totalPromptTokens),
        totalCompletionTokens: num(Result?.totalCompletionTokens),
        totalCachedTokens: num(Result?.totalCachedTokens),
        totalCacheCreationTokens: num(Result?.totalCacheCreationTokens),
        totalReasoningTokens: num(Result?.totalReasoningTokens),
        totalEstimatedCost: num(Result?.totalEstimatedCost),
        totalInputTokens: num(Result?.totalPromptTokens),
        totalOutputTokens: num(Result?.totalCompletionTokens)
    };
}

export function getProviderModelUsageDB(providerId: string): ModelUsageSummaryRow[] {
    const Query = db.prepare(`
        SELECT 
            model,
            COUNT(*) as totalRequests,
            COALESCE(SUM(total_tokens), 0) as totalTokens,
            COALESCE(SUM(prompt_tokens), 0) as promptTokens,
            COALESCE(SUM(completion_tokens), 0) as completionTokens,
            COALESCE(SUM(cached_tokens), 0) as cachedTokens,
            COALESCE(SUM(estimated_cost), 0) as estimatedCost,
            MAX(created_at) as lastUsedAt
        FROM request_logs
        WHERE provider_id = ?
        GROUP BY model
        ORDER BY lastUsedAt DESC
    `);

    const Rows = Query.all(providerId) as unknown as ModelUsageDBShape[];

    return Rows.map((row) => ({
        model: row.model,
        totalRequests: row.totalRequests,
        totalTokens: row.totalTokens,
        promptTokens: row.promptTokens,
        completionTokens: row.completionTokens,
        cachedTokens: row.cachedTokens,
        estimatedCost: row.estimatedCost,
        lastUsedAt: row.lastUsedAt
    }));
}

export function getUsageByModelDB(): UsageByModelRow[] {
    const Query = db.prepare(`
        SELECT 
            model,
            COUNT(*) as totalRequests,
            COALESCE(SUM(prompt_tokens), 0) as totalInputTokens,
            COALESCE(SUM(completion_tokens), 0) as totalOutputTokens,
            COALESCE(SUM(cached_tokens), 0) as totalCachedTokens,
            COALESCE(SUM(estimated_cost), 0) as estCost
        FROM request_logs
        GROUP BY model
        ORDER BY totalRequests DESC
    `);

    const Rows = Query.all() as unknown as UsageByModelDBShape[];

    return Rows.map((row) => ({
        model: row.model,
        totalRequests: row.totalRequests,
        totalInputTokens: row.totalInputTokens,
        totalOutputTokens: row.totalOutputTokens,
        totalCachedTokens: row.totalCachedTokens,
        estCost: row.estCost
    }));
}

export function deleteLogsByModelDB(model: string): void {
    const Query = db.prepare("DELETE FROM request_logs WHERE model = ?");
    Query.run(model);
}

export function deleteLogsByProviderDB(providerId: string): void {
    const Query = db.prepare("DELETE FROM request_logs WHERE provider_id = ?");
    Query.run(providerId);
}

function mapLogRow(row: RequestLogRow): RequestLogEntry {
    return {
        id: str(row.id),
        apiKeyId: optStr(row.api_key_id),
        providerId: str(row.provider_id),
        model: str(row.model),
        promptTokens: num(row.prompt_tokens),
        completionTokens: num(row.completion_tokens),
        totalTokens: num(row.total_tokens),
        statusCode: num(row.status_code),
        latencyMs: num(row.latency_ms),
        cachedTokens: num(row.cached_tokens),
        cacheCreationTokens: num(row.cache_creation_tokens),
        reasoningTokens: num(row.reasoning_tokens),
        estimatedCost: num(row.estimated_cost),
        fallbackOccurred: Boolean(row.fallback_occurred),
        fallbackPath: optStr(row.fallback_path),
        fallbackReason: optStr(row.fallback_reason),
        resolvedModel: optStr(row.resolved_model),
        createdAt: num(row.created_at)
    };
}

// --- Analytics ---

export interface AnalyticsDBResult {
    buckets: AnalyticsBucketRow[];
    topModels: AnalyticsTopModelRow[];
    providers: AnalyticsProviderRow[];
    p95LatencyMs: number;
    rps: number;
}

interface AnalyticsBucketRow {
    bucket: number;
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    avgLatencyMs: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
}

interface AnalyticsTopModelRow {
    model: string;
    totalRequests: number;
    totalTokens: number;
    estCost: number;
}

interface AnalyticsProviderRow {
    providerId: string;
    totalRequests: number;
}

export function getBucketSizeMs(window: AnalyticsWindow): number {
    switch (window) {
        case "1h":
            return 60_000;
        case "24h":
            return 3_600_000;
        case "7d":
            return 21_600_000;
        case "30d":
            return 86_400_000;
    }
}

export function getBucketCount(window: AnalyticsWindow): number {
    switch (window) {
        case "1h":
            return 60;
        case "24h":
            return 24;
        case "7d":
            return 28;
        case "30d":
            return 30;
    }
}

export function getAnalyticsDB(window: AnalyticsWindow): AnalyticsDBResult {
    const Now = Date.now();
    const BucketSizeMs = getBucketSizeMs(window);
    const Since = Now - BucketSizeMs * getBucketCount(window);

    // A. Time buckets — node:sqlite binds numbers as REAL, so division yields a
    // float and `(x / b) * b` round-trips. CAST truncates to the bucket start.
    const BucketsSql = `
        SELECT
            CAST(created_at / ? AS INTEGER) * ? AS bucket,
            COUNT(*)                                             AS totalRequests,
            SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) AS successRequests,
            SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)  AS errorRequests,
            AVG(latency_ms)                                      AS avgLatencyMs,
            SUM(total_tokens)                                    AS totalTokens,
            SUM(prompt_tokens)                                   AS promptTokens,
            SUM(completion_tokens)                               AS completionTokens,
            SUM(cached_tokens)                                   AS cachedTokens
        FROM request_logs
        WHERE created_at >= ?
        GROUP BY bucket ORDER BY bucket ASC
    `;
    const Buckets = db
        .prepare(BucketsSql)
        .all(BucketSizeMs, BucketSizeMs, Since) as unknown as AnalyticsBucketRow[];

    // B. Top models (limit 10)
    const ModelsSql = `
        SELECT model, COUNT(*) AS totalRequests, SUM(total_tokens) AS totalTokens,
               SUM(estimated_cost) AS estCost
        FROM request_logs WHERE created_at >= ?
        GROUP BY model ORDER BY totalRequests DESC LIMIT 10
    `;
    const TopModels = db.prepare(ModelsSql).all(Since) as unknown as AnalyticsTopModelRow[];

    // C. Provider split
    const ProviderSql = `
        SELECT provider_id AS providerId, COUNT(*) AS totalRequests
        FROM request_logs WHERE created_at >= ?
        GROUP BY providerId ORDER BY totalRequests DESC
    `;
    const Providers = db.prepare(ProviderSql).all(Since) as unknown as AnalyticsProviderRow[];

    // D. p95 latency — keep the sort in SQLite, return a single row
    const P95Sql = `
        SELECT latency_ms FROM request_logs
        WHERE created_at >= ?
        ORDER BY latency_ms
        LIMIT 1 OFFSET (SELECT CAST(COUNT(*) * 0.95 AS INTEGER) - 1 FROM request_logs WHERE created_at >= ?)
    `;
    const P95Row = db.prepare(P95Sql).get(Since, Since) as { latency_ms: number } | undefined;
    const P95LatencyMs = P95Row ? num(P95Row.latency_ms) : 0;

    // E. RPS (last 60s rolling average)
    const RpsSql = `SELECT COUNT(*) AS count FROM request_logs WHERE created_at >= ?`;
    const RpsRow = db.prepare(RpsSql).get(Now - 60_000) as { count: number } | undefined;
    const Rps = RpsRow ? Math.round((num(RpsRow.count) / 60) * 100) / 100 : 0;

    return {
        buckets: Buckets,
        topModels: TopModels,
        providers: Providers,
        p95LatencyMs: P95LatencyMs,
        rps: Rps
    };
}

export function getUsagePeriodStatsDB(period: string = "today"): {
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
    recentRequests?: Array<{
        id: string;
        model: string;
        providerId: string;
        promptTokens: number;
        completionTokens: number;
        cachedTokens: number;
        statusCode: number;
        timestamp: number;
        latencyMs: number;
    }>;
} {
    const now = Date.now();
    let since = 0;
    let chartBucketCount = 24;
    let chartBucketMs = 3600000;
    let isDaily = false;

    if (period === "today") {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        since = startOfDay.getTime();
        chartBucketCount = 24;
        chartBucketMs = 3600000;
    } else if (period === "24h") {
        since = now - 24 * 3600000;
        chartBucketCount = 24;
        chartBucketMs = 3600000;
    } else if (period === "7d") {
        since = now - 7 * 86400000;
        chartBucketCount = 7;
        chartBucketMs = 86400000;
        isDaily = true;
    } else if (period === "30d") {
        since = now - 30 * 86400000;
        chartBucketCount = 30;
        chartBucketMs = 86400000;
        isDaily = true;
    } else if (period === "60d") {
        since = now - 60 * 86400000;
        chartBucketCount = 60;
        chartBucketMs = 86400000;
        isDaily = true;
    } else {
        // all
        since = 0;
        chartBucketCount = 30;
        chartBucketMs = 86400000;
        isDaily = true;
    }

    // 1. Overall Summary in period
    const summaryQuery = db.prepare(`
        SELECT 
            COUNT(*) as totalRequests,
            COALESCE(SUM(total_tokens), 0) as totalTokens,
            COALESCE(SUM(prompt_tokens), 0) as totalPromptTokens,
            COALESCE(SUM(completion_tokens), 0) as totalCompletionTokens,
            COALESCE(SUM(cached_tokens), 0) as totalCachedTokens,
            COALESCE(SUM(estimated_cost), 0) as totalEstimatedCost
        FROM request_logs
        WHERE created_at >= ?
    `);
    const summaryRow = summaryQuery.get(since) as any;

    // 2. By Model
    const modelQuery = db.prepare(`
        SELECT 
            model,
            provider_id as providerId,
            COUNT(*) as totalRequests,
            COALESCE(SUM(total_tokens), 0) as totalTokens,
            COALESCE(SUM(prompt_tokens), 0) as promptTokens,
            COALESCE(SUM(completion_tokens), 0) as completionTokens,
            COALESCE(SUM(cached_tokens), 0) as cachedTokens,
            COALESCE(SUM(estimated_cost), 0) as estimatedCost,
            MAX(created_at) as lastUsedAt
        FROM request_logs
        WHERE created_at >= ?
        GROUP BY model, provider_id
        ORDER BY totalRequests DESC
    `);
    const modelRows = modelQuery.all(since) as any[];

    // 3. By Provider
    const providerQuery = db.prepare(`
        SELECT 
            provider_id as providerId,
            COUNT(*) as totalRequests,
            COALESCE(SUM(total_tokens), 0) as totalTokens,
            COALESCE(SUM(prompt_tokens), 0) as promptTokens,
            COALESCE(SUM(completion_tokens), 0) as completionTokens,
            COALESCE(SUM(cached_tokens), 0) as cachedTokens,
            COALESCE(SUM(estimated_cost), 0) as estimatedCost,
            MAX(created_at) as lastUsedAt
        FROM request_logs
        WHERE created_at >= ?
        GROUP BY provider_id
        ORDER BY totalRequests DESC
    `);
    const providerRows = providerQuery.all(since) as any[];

    // 4. By API Key
    const apiKeyQuery = db.prepare(`
        SELECT 
            api_key_id as apiKeyId,
            COUNT(*) as totalRequests,
            COALESCE(SUM(total_tokens), 0) as totalTokens,
            COALESCE(SUM(prompt_tokens), 0) as promptTokens,
            COALESCE(SUM(completion_tokens), 0) as completionTokens,
            COALESCE(SUM(cached_tokens), 0) as cachedTokens,
            COALESCE(SUM(estimated_cost), 0) as estimatedCost,
            MAX(created_at) as lastUsedAt
        FROM request_logs
        WHERE created_at >= ?
        GROUP BY api_key_id
        ORDER BY totalRequests DESC
    `);
    const apiKeyRows = apiKeyQuery.all(since) as any[];

    // 5. Chart Data
    const chartData: Array<{ label: string; timestamp?: number; tokens: number; cost: number; requests: number }> = [];
    if (period === "today") {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startTime = startOfDay.getTime();
        for (let i = 0; i < 24; i++) {
            const bucketStart = startTime + i * 3600000;
            const d = new Date(bucketStart);
            const label = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
            chartData.push({ label, timestamp: bucketStart, tokens: 0, cost: 0, requests: 0 });
        }
    } else if (period === "24h") {
        const startTime = now - 24 * 3600000;
        for (let i = 0; i < 24; i++) {
            const bucketStart = startTime + i * 3600000;
            const d = new Date(bucketStart);
            const label = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
            chartData.push({ label, timestamp: bucketStart, tokens: 0, cost: 0, requests: 0 });
        }
    } else {
        const count = chartBucketCount;
        const today = new Date();
        for (let i = 0; i < count; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - (count - 1 - i));
            d.setHours(0, 0, 0, 0);
            const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            chartData.push({ label, timestamp: d.getTime(), tokens: 0, cost: 0, requests: 0 });
        }
    }

    // Populate chart buckets from request_logs
    const logsForChartQuery = db.prepare(`
        SELECT created_at, prompt_tokens, completion_tokens, total_tokens, estimated_cost
        FROM request_logs
        WHERE created_at >= ?
    `);
    const chartLogRows = logsForChartQuery.all(since) as any[];

    for (const row of chartLogRows) {
        const ts = num(row.created_at);
        if (period === "today" || period === "24h") {
            const startTime = chartData[0]?.timestamp || since;
            const idx = Math.floor((ts - startTime) / 3600000);
            if (idx >= 0 && idx < chartData.length) {
                chartData[idx].tokens += num(row.total_tokens);
                chartData[idx].cost += num(row.estimated_cost);
                chartData[idx].requests += 1;
            }
        } else {
            const d = new Date(ts);
            d.setHours(0, 0, 0, 0);
            const dayTs = d.getTime();
            const bucket = chartData.find(b => b.timestamp && Math.abs(b.timestamp - dayTs) < 43200000);
            if (bucket) {
                bucket.tokens += num(row.total_tokens);
                bucket.cost += num(row.estimated_cost);
                bucket.requests += 1;
            }
        }
    }

    // 6. Recent Requests
    const recentRequestsQuery = db.prepare(`
        SELECT 
            id,
            model,
            provider_id as providerId,
            prompt_tokens as promptTokens,
            completion_tokens as completionTokens,
            cached_tokens as cachedTokens,
            status_code as statusCode,
            created_at as timestamp,
            latency_ms as latencyMs
        FROM request_logs
        ORDER BY created_at DESC
        LIMIT 25
    `);
    const recentRequestsRows = recentRequestsQuery.all() as any[];

    return {
        period,
        totalRequests: num(summaryRow?.totalRequests),
        totalTokens: num(summaryRow?.totalTokens),
        totalPromptTokens: num(summaryRow?.totalPromptTokens),
        totalCompletionTokens: num(summaryRow?.totalCompletionTokens),
        totalCachedTokens: num(summaryRow?.totalCachedTokens),
        totalCost: num(summaryRow?.totalEstimatedCost),
        byModel: modelRows.map(r => ({
            model: r.model,
            providerId: r.providerId,
            totalRequests: num(r.totalRequests),
            totalTokens: num(r.totalTokens),
            promptTokens: num(r.promptTokens),
            completionTokens: num(r.completionTokens),
            cachedTokens: num(r.cachedTokens),
            estimatedCost: num(r.estimatedCost),
            lastUsedAt: r.lastUsedAt ? num(r.lastUsedAt) : null
        })),
        byProvider: providerRows.map(r => ({
            providerId: r.providerId,
            totalRequests: num(r.totalRequests),
            totalTokens: num(r.totalTokens),
            promptTokens: num(r.promptTokens),
            completionTokens: num(r.completionTokens),
            cachedTokens: num(r.cachedTokens),
            estimatedCost: num(r.estimatedCost),
            lastUsedAt: r.lastUsedAt ? num(r.lastUsedAt) : null
        })),
        byApiKey: apiKeyRows.map((r) => ({
            apiKeyId: r.apiKeyId,
            totalRequests: num(r.totalRequests),
            totalTokens: num(r.totalTokens),
            promptTokens: num(r.promptTokens),
            completionTokens: num(r.completionTokens),
            cachedTokens: num(r.cachedTokens),
            estimatedCost: num(r.estimatedCost),
            lastUsedAt: r.lastUsedAt ? num(r.lastUsedAt) : null
        })),
        chartData,
        recentRequests: recentRequestsRows.map(r => ({
            id: r.id,
            model: r.model,
            providerId: r.providerId,
            promptTokens: num(r.promptTokens),
            completionTokens: num(r.completionTokens),
            cachedTokens: num(r.cachedTokens),
            statusCode: num(r.statusCode),
            timestamp: num(r.timestamp),
            latencyMs: num(r.latencyMs)
        }))
    };
}

export function getRequestDetailsDB(filter: {
    page?: number;
    pageSize?: number;
    provider?: string;
    model?: string;
    apiKeyId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
}): {
    details: RequestLogEntry[];
    total: number;
} {
    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.provider) {
        conditions.push("provider_id = ?");
        params.push(filter.provider);
    }
    if (filter.model) {
        conditions.push("model LIKE ?");
        params.push(`%${filter.model}%`);
    }
    if (filter.apiKeyId) {
        conditions.push("api_key_id = ?");
        params.push(filter.apiKeyId);
    }
    if (filter.status === "success") {
        conditions.push("status_code >= 200 AND status_code < 300");
    } else if (filter.status === "error") {
        conditions.push("status_code >= 400");
    }
    if (filter.startDate) {
        const startTs = new Date(filter.startDate).getTime();
        if (!isNaN(startTs)) {
            conditions.push("created_at >= ?");
            params.push(startTs);
        }
    }
    if (filter.endDate) {
        const endTs = new Date(filter.endDate).getTime();
        if (!isNaN(endTs)) {
            conditions.push("created_at <= ?");
            params.push(endTs);
        }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = db.prepare(`SELECT COUNT(*) as total FROM request_logs ${whereClause}`);
    const countRow = countQuery.get(...params) as { total: number };
    const total = num(countRow?.total);

    const dataQuery = db.prepare(`
        SELECT * FROM request_logs 
        ${whereClause} 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    `);
    const rows = dataQuery.all(...params, pageSize, offset) as unknown as RequestLogRow[];

    return {
        details: rows.map(mapLogRow),
        total
    };
}
