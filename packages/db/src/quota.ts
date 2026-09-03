import { CODEBUDDY_CN_DOMAIN, CODEBUDDY_CN_USER_AGENT, isProviderBaseId } from "@srouter/constants";
import type {
    LiveModelQuotaItem,
    ProviderQuotaAccount,
    ProviderUsageMetric,
    QuotaResponse
} from "@srouter/types";
import { getProviderModelUsageDB } from "./logs.js";
import { getAllProvidersDB } from "./providers.js";
import { num, str } from "./row-utils.js";

function formatResetIn(resetTimeStr?: string): string {
    if (!resetTimeStr) return "24h 0m";
    const ResetTime = new Date(resetTimeStr).getTime();
    const Now = Date.now();
    const DiffMs = ResetTime - Now;
    if (DiffMs <= 0) return "0m";
    const Days = Math.floor(DiffMs / (1000 * 60 * 60 * 24));
    const Hours = Math.floor(DiffMs / (1000 * 60 * 60));
    if (Days > 0) {
        return `${Days}d ${Hours - Days * 24}h`;
    }
    const Minutes = Math.floor((DiffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (Hours > 0) {
        return `${Hours}h ${Minutes}m`;
    }
    return `${Minutes}m`;
}

interface CloudCodeFetchAvailableModelsResponse {
    models?: Record<
        string,
        {
            displayName?: string;
            quotaInfo?: {
                remainingFraction?: number;
                resetTime?: string;
            };
        }
    >;
}

export async function fetchAntigravityLiveQuota(
    providerId: string,
    accountName: string,
    accessToken: string,
    enabled = true
): Promise<ProviderQuotaAccount> {
    if (!accessToken || !(accessToken.startsWith("ya29.") || accessToken.length > 20)) {
        throw new Error("Antigravity quota requires a valid access token");
    }

    const Res = await fetch("https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": "Antigravity/1.0 (VSCode)",
            "x-goog-api-client": "gl-node/18.0.0 gd/1.0.0"
        },
        body: JSON.stringify({})
    });

    if (!Res.ok) {
        throw new Error(`Antigravity quota fetch failed: HTTP ${Res.status}`);
    }

    const Data = (await Res.json()) as CloudCodeFetchAvailableModelsResponse;
    if (!Data.models || Object.keys(Data.models).length === 0) {
        throw new Error("Antigravity quota fetch returned no models");
    }

    const Quotas: LiveModelQuotaItem[] = Object.entries(Data.models).map(([modelId, item]) => {
        const RemainingFraction = item.quotaInfo?.remainingFraction ?? 1.0;
        const PercentageValue = Math.round(RemainingFraction * 100);
        const Limit = 1000;
        const Used = Math.round((1 - RemainingFraction) * Limit);
        const ResetIn = formatResetIn(item.quotaInfo?.resetTime);

        let Status: "ok" | "warning" | "exhausted" = "ok";
        if (PercentageValue <= 5) Status = "exhausted";
        else if (PercentageValue <= 20) Status = "warning";

        return {
            name: item.displayName || modelId,
            used: Used,
            limit: Limit,
            percentage: `${PercentageValue}%`,
            percentageValue: PercentageValue,
            resetIn: ResetIn,
            resetTime: item.quotaInfo?.resetTime,
            status: Status
        };
    });

    return {
        id: providerId,
        provider: "Antigravity",
        account: accountName,
        enabled,
        quotaType: "live_provider_quota",
        totalQuotas: Quotas.length,
        quotas: Quotas
    };
}

interface CodeBuddyCNAccount {
    PackageName?: string;
    SubProductName?: string;
    CycleStartTime?: string;
    CycleEndTime?: string;
    DeductionEndTime?: number;
    CycleCapacityUsed?: number;
    CycleCapacityUsedPrecise?: string;
    CycleCapacitySize?: number;
    CycleCapacitySizePrecise?: string;
    CapacityUsed?: number;
    CapacityUsedPrecise?: string;
    CapacitySize?: number;
    CapacitySizePrecise?: string;
}

const CN_REFILL_GAP_MS = 2 * 24 * 60 * 60 * 1000;

export async function fetchCodeBuddyCNLiveQuota(
    providerId: string,
    accountName: string,
    accessToken: string,
    enabled = true
): Promise<ProviderQuotaAccount> {
    if (!accessToken) {
        throw new Error("CodeBuddy CN quota requires an access token");
    }

    const Res = await fetch("https://copilot.tencent.com/v2/billing/meter/get-user-resource", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": CODEBUDDY_CN_USER_AGENT,
            "X-Product": "SaaS",
            "X-IDE-Type": "CLI",
            "X-IDE-Name": "CLI",
            "X-Domain": CODEBUDDY_CN_DOMAIN,
            "x-requested-with": "XMLHttpRequest",
            "x-codebuddy-request": "1"
        },
        body: "{}"
    });

    if (!Res.ok) {
        throw new Error(`CodeBuddy CN quota fetch failed: HTTP ${Res.status}`);
    }

    const Json = (await Res.json()) as {
        code?: number;
        msg?: string;
        data?: { Response?: { Data?: { Accounts?: CodeBuddyCNAccount[] } } };
    };
    if (Json.code !== 0) {
        throw new Error(`CodeBuddy CN quota error: ${Json.msg || "unknown"}`);
    }

    const Accounts = Json.data?.Response?.Data?.Accounts ?? [];
    if (Accounts.length === 0) {
        throw new Error("CodeBuddy CN quota fetch returned no credit packages");
    }

    const cycleEndMs = (acc: CodeBuddyCNAccount): number => {
        const T = acc.CycleEndTime ? new Date(acc.CycleEndTime).getTime() : NaN;
        return Number.isFinite(T) ? T : Number.POSITIVE_INFINITY;
    };
    const isRefill = (acc: CodeBuddyCNAccount): boolean => {
        const Ce = cycleEndMs(acc);
        const De = num(acc.DeductionEndTime);
        return Number.isFinite(Ce) && Number.isFinite(De) && De - Ce > CN_REFILL_GAP_MS;
    };
    const byExpiry = (a: CodeBuddyCNAccount, b: CodeBuddyCNAccount) =>
        cycleEndMs(a) - cycleEndMs(b);

    const Refills = Accounts.filter(isRefill).sort(byExpiry);
    const Bonuses = Accounts.filter((a) => !isRefill(a)).sort(byExpiry);

    const toItem = (
        name: string,
        used: number,
        total: number,
        resetTime?: string
    ): LiveModelQuotaItem => {
        const RemainingFraction = total > 0 ? (total - used) / total : 1;
        return {
            name,
            used: Math.round(used * 100) / 100,
            limit: Math.round(total * 100) / 100,
            percentage: total > 0 ? `${Math.round((used / total) * 100)}%` : "0%",
            percentageValue: total > 0 ? Math.round((used / total) * 100) : 0,
            resetIn: formatResetIn(resetTime),
            resetTime,
            status:
                RemainingFraction <= 0.05
                    ? "exhausted"
                    : RemainingFraction <= 0.2
                      ? "warning"
                      : "ok"
        };
    };

    const parseNum = (precise?: string, plain?: number): number => {
        return num(precise ?? plain);
    };

    const Quotas: LiveModelQuotaItem[] = [];
    const SeenCadence: Record<string, number> = {};
    for (const acc of Refills) {
        const CycleStartMs = acc.CycleStartTime ? new Date(acc.CycleStartTime).getTime() : NaN;
        const CycleDays = (cycleEndMs(acc) - CycleStartMs) / 86400000;
        const Base =
            Number.isFinite(CycleDays) && CycleDays <= 1.5
                ? "Daily"
                : Number.isFinite(CycleDays) && CycleDays <= 10
                  ? "Weekly"
                  : "Monthly";
        SeenCadence[Base] = (SeenCadence[Base] ?? 0) + 1;
        const Name = SeenCadence[Base]! > 1 ? `${Base} ${SeenCadence[Base]}` : Base;
        Quotas.push(
            toItem(
                Name,
                parseNum(acc.CycleCapacityUsedPrecise, acc.CycleCapacityUsed),
                parseNum(acc.CycleCapacitySizePrecise, acc.CycleCapacitySize),
                acc.CycleEndTime
            )
        );
    }
    Bonuses.forEach((acc, i) => {
        Quotas.push(
            toItem(
                `Bonus Pack ${i + 1}`,
                parseNum(acc.CapacityUsedPrecise, acc.CapacityUsed),
                parseNum(acc.CapacitySizePrecise, acc.CapacitySize),
                acc.CycleEndTime
            )
        );
    });

    const BasePkg = Refills[0] ?? Accounts[0] ?? {};
    const Plan = BasePkg.PackageName || BasePkg.SubProductName;

    return {
        id: providerId,
        provider: Plan ? `CodeBuddy CN (${Plan})` : "CodeBuddy CN",
        account: accountName,
        enabled,
        quotaType: "live_provider_quota",
        totalQuotas: Quotas.length,
        quotas: Quotas
    };
}

interface QoderQuotaUsageResponse {
    userId?: string;
    userType?: string;
    usageType?: string;
    totalUsagePercentage?: number;
    isQuotaExceeded?: boolean;
    expiresAt?: number;
    userQuota?: {
        total?: number;
        used?: number;
        remaining?: number;
        percentage?: number;
        unit?: string;
    };
    orgResourcePackage?: {
        total?: number;
        used?: number;
        remaining?: number;
        percentage?: number;
        unit?: string;
    };
}

const qoderPatJobCache = new Map<string, { jobToken: string; expiresAt: number }>();

async function exchangeQoderJobToken(pat: string): Promise<string> {
    const cached = qoderPatJobCache.get(pat);
    if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) {
        return cached.jobToken;
    }

    const res = await fetch("https://openapi.qoder.sh/api/v1/jobToken/exchange", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "qodercli/1.0.0"
        },
        body: JSON.stringify({ personal_token: pat })
    });

    if (!res.ok) {
        throw new Error(`Qoder PAT exchange failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { token?: string; expires_in?: number; expires_at?: string };
    if (!data.token) throw new Error("Qoder PAT exchange returned no token");

    let expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    if (data.expires_in) expiresAt = Date.now() + data.expires_in;
    else if (data.expires_at) expiresAt = new Date(data.expires_at).getTime() || expiresAt;

    qoderPatJobCache.set(pat, { jobToken: data.token, expiresAt });
    return data.token;
}

export async function fetchQoderLiveQuota(
    providerId: string,
    accountName: string,
    rawToken: string,
    enabled = true
): Promise<ProviderQuotaAccount> {
    if (!rawToken) {
        throw new Error("Qoder quota requires an access token or PAT");
    }

    let activeToken = rawToken;
    if (rawToken.startsWith("pt-")) {
        activeToken = await exchangeQoderJobToken(rawToken);
    }

    const res = await fetch("https://openapi.qoder.sh/api/v2/quota/usage", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${activeToken}`,
            Accept: "application/json",
            "User-Agent": "qodercli/1.0.0"
        }
    });

    if (!res.ok) {
        throw new Error(`Qoder quota fetch failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as QoderQuotaUsageResponse;
    const expiresAtIso = data.expiresAt ? new Date(data.expiresAt).toISOString() : undefined;
    const resetIn = formatResetIn(expiresAtIso);

    const Quotas: LiveModelQuotaItem[] = [];

    if (data.userQuota && (data.userQuota.total || 0) > 0) {
        const total = data.userQuota.total || 0;
        const used = data.userQuota.used || 0;
        const remaining = data.userQuota.remaining ?? total - used;
        const remainingPct = total > 0 ? Math.round((remaining / total) * 100) : 0;

        let status: "ok" | "warning" | "exhausted" = "ok";
        if (remainingPct <= 5) status = "exhausted";
        else if (remainingPct <= 20) status = "warning";

        Quotas.push({
            name: "Personal Credits",
            used: Math.round(used * 100) / 100,
            limit: Math.round(total * 100) / 100,
            percentage: `${remainingPct}%`,
            percentageValue: remainingPct,
            resetIn,
            resetTime: expiresAtIso,
            status
        });
    }

    if (data.orgResourcePackage && (data.orgResourcePackage.total || 0) > 0) {
        const total = data.orgResourcePackage.total || 0;
        const used = data.orgResourcePackage.used || 0;
        const remaining = data.orgResourcePackage.remaining ?? total - used;
        const remainingPct = total > 0 ? Math.round((remaining / total) * 100) : 0;

        let status: "ok" | "warning" | "exhausted" = "ok";
        if (remainingPct <= 5) status = "exhausted";
        else if (remainingPct <= 20) status = "warning";

        Quotas.push({
            name: "Organization Credits",
            used: Math.round(used * 100) / 100,
            limit: Math.round(total * 100) / 100,
            percentage: `${remainingPct}%`,
            percentageValue: remainingPct,
            resetIn,
            resetTime: expiresAtIso,
            status
        });
    }

    if (Quotas.length === 0) {
        const totalUsagePct = Math.round((data.totalUsagePercentage || 0) * 100);
        const remainingPct = Math.max(0, 100 - totalUsagePct);
        Quotas.push({
            name: "Plan Quota",
            used: totalUsagePct,
            limit: 100,
            percentage: `${remainingPct}%`,
            percentageValue: remainingPct,
            resetIn,
            resetTime: expiresAtIso,
            status: data.isQuotaExceeded ? "exhausted" : remainingPct <= 20 ? "warning" : "ok"
        });
    }

    return {
        id: providerId,
        provider: "Qoder",
        account: accountName,
        enabled,
        quotaType: "live_provider_quota",
        totalQuotas: Quotas.length,
        quotas: Quotas
    };
}

export async function getProviderQuotaAccount(p: {
    id: string;
    providerId: string;
    name: string;
    apiKey?: string;
    accessToken?: string;
    enabled: boolean;
}): Promise<ProviderQuotaAccount> {
    const IsAntigravity =
        isProviderBaseId(p.providerId, "antigravity") || isProviderBaseId(p.id, "antigravity");
    const IsQoder =
        isProviderBaseId(p.providerId, "qoder") || isProviderBaseId(p.id, "qoder");
    const IsOpenAICodex =
        isProviderBaseId(p.providerId, "openai_codex") || isProviderBaseId(p.id, "openai_codex");
    const IsOpenAI = isProviderBaseId(p.providerId, "openai") || isProviderBaseId(p.id, "openai");
    const IsAnthropic =
        isProviderBaseId(p.providerId, "anthropic") || isProviderBaseId(p.id, "anthropic");
    const IsCodeBuddyCN =
        isProviderBaseId(p.providerId, "codebuddy-cn") || isProviderBaseId(p.id, "codebuddy-cn");
    const IsCodeBuddy =
        !IsCodeBuddyCN &&
        (isProviderBaseId(p.providerId, "codebuddy") || isProviderBaseId(p.id, "codebuddy"));

    const Token = p.accessToken || p.apiKey || "";

    if (IsQoder) {
        return await fetchQoderLiveQuota(
            p.id,
            p.name || "Qoder Account",
            Token,
            p.enabled
        );
    }

    if (IsCodeBuddy) {
        throw new Error("CodeBuddy (international) does not expose a live quota endpoint");
    }

    if (IsCodeBuddyCN) {
        return await fetchCodeBuddyCNLiveQuota(
            p.id,
            p.name || "CodeBuddy CN Account",
            Token,
            p.enabled
        );
    }

    if (IsAntigravity) {
        return await fetchAntigravityLiveQuota(
            p.id,
            p.name || "seaavey@gmail.com",
            Token,
            p.enabled
        );
    }

    const UsageRows = getProviderModelUsageDB(p.id);
    const UsageMetrics: ProviderUsageMetric[] = UsageRows.map((row) => ({
        model: row.model,
        totalRequests: row.totalRequests,
        totalTokens: row.totalTokens,
        promptTokens: row.promptTokens,
        completionTokens: row.completionTokens,
        lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null
    }));

    let ProviderName = p.name || p.providerId || p.id;
    if (IsOpenAICodex) ProviderName = "OpenAI Codex";
    else if (IsOpenAI) ProviderName = "OpenAI";
    else if (IsAnthropic) ProviderName = "Anthropic";

    return {
        id: p.id,
        provider: ProviderName,
        account: p.name || `${ProviderName} Account`,
        enabled: p.enabled,
        quotaType: "usage_logged",
        usageMetrics: UsageMetrics
    };
}

export async function getQuotaSummaryDB(): Promise<QuotaResponse> {
    const DbProviders = getAllProvidersDB();
    const ProviderAccounts: ProviderQuotaAccount[] = [];

    for (const p of DbProviders) {
        try {
            const Account = await getProviderQuotaAccount(p);
            ProviderAccounts.push(Account);
        } catch {
            // Skip providers whose quota cannot be fetched
        }
    }

    return {
        object: "quota",
        totalAccounts: ProviderAccounts.length,
        providers: ProviderAccounts
    };
}
