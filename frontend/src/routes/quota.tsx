import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Plus,
    RefreshCw,
    Shield,
    Gauge
} from "lucide-react";
import { toast } from "sonner";
import { QuotaSkeleton } from "@/components/skeletons";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProviderIcon } from "@/components/ProviderIcon";
import { cn } from "@/lib/utils";
import { useQuota } from "@/hooks/useQuota";
import type { LiveModelQuotaItem, ProviderQuotaAccount } from "@srouter/types";

export const Route = createFileRoute("/quota")({
    staticData: { title: "Quota Tracker" },
    component: QuotaPage
});

function formatResetCountdown(isoStr?: string, resetIn?: string): string {
    if (!isoStr && !resetIn) return "-";
    if (isoStr) {
        try {
            const resetDate = new Date(isoStr);
            const now = new Date();
            const diffMs = resetDate.getTime() - now.getTime();
            if (diffMs <= 0) return "Reset ready";
            const totalMinutes = Math.ceil(diffMs / (1000 * 60));
            if (totalMinutes < 60) return `${totalMinutes}m`;
            const totalHours = Math.floor(totalMinutes / 60);
            const remainingMinutes = totalMinutes % 60;
            if (totalHours < 24) return `${totalHours}h ${remainingMinutes}m`;
            const days = Math.floor(totalHours / 24);
            const remHours = totalHours % 24;
            return `${days}d ${remHours}h ${remainingMinutes}m`;
        } catch {
            return resetIn || "-";
        }
    }
    return resetIn || "-";
}

function formatResetTimeDisplay(isoStr?: string): string | null {
    if (!isoStr) return null;
    try {
        const resetDate = new Date(isoStr);
        const now = new Date();
        const isToday = resetDate.toDateString() === now.toDateString();
        const isTomorrow =
            resetDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();
        const timeStr = resetDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
        if (isToday) return `Today, ${timeStr}`;
        if (isTomorrow) return `Tomorrow, ${timeStr}`;
        return resetDate.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
    } catch {
        return null;
    }
}

function QuotaItemRow({ quota }: { quota: LiveModelQuotaItem }) {
    const remaining = Math.max(
        0,
        Math.min(
            100,
            quota.percentageValue ??
                (quota.limit ? Math.round(((quota.limit - quota.used) / quota.limit) * 100) : 100)
        )
    );

    const isExhausted = remaining === 0 || quota.status === "exhausted";
    const isMid = remaining >= 30 && remaining <= 70;
    const isLow = remaining < 30 && remaining > 0;

    let emoji = "🟢";
    let statusTextColor = "text-emerald-500 dark:text-emerald-400";
    let barBgColor = "bg-emerald-500";
    let trackBgColor = "bg-emerald-500/15";

    if (isExhausted) {
        emoji = "🔴";
        statusTextColor = "text-rose-500 dark:text-rose-400";
        barBgColor = "bg-rose-500";
        trackBgColor = "bg-rose-500/15";
    } else if (isLow) {
        emoji = "🔴";
        statusTextColor = "text-rose-500 dark:text-rose-400";
        barBgColor = "bg-rose-500";
        trackBgColor = "bg-rose-500/15";
    } else if (isMid) {
        emoji = "🟡";
        statusTextColor = "text-amber-500 dark:text-amber-400";
        barBgColor = "bg-amber-500";
        trackBgColor = "bg-amber-500/15";
    }

    const countdown = formatResetCountdown(quota.resetTime, quota.resetIn);
    const resetDisplay = formatResetTimeDisplay(quota.resetTime);

    return (
        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5 space-y-2.5 transition-all hover:border-border hover:bg-card">
            {/* Model Name & Percentage */}
            <div className="flex items-center justify-between text-xs font-sans">
                <span
                    className="font-medium text-foreground truncate max-w-[70%]"
                    title={quota.name}
                >
                    {quota.name}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs">{emoji}</span>
                    <span
                        className={cn(
                            "font-semibold font-mono text-xs tabular-nums",
                            statusTextColor
                        )}
                    >
                        {remaining}%
                    </span>
                </div>
            </div>

            {/* Progress Bar Track */}
            <div className={cn("h-2 w-full rounded-full overflow-hidden", trackBgColor)}>
                <div
                    className={cn("h-full rounded-full transition-all duration-300", barBgColor)}
                    style={{ width: `${remaining}%` }}
                />
            </div>

            {/* Usage Details & Countdown Meta */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-sans pt-0.5">
                <span className="tabular-nums font-mono">
                    {quota.used.toLocaleString()} / {quota.limit.toLocaleString()} requests
                </span>
                {countdown !== "-" && (
                    <div className="flex items-center gap-1.5 font-medium">
                        <span className="size-1 rounded-full bg-muted-foreground/40" />
                        <span>Reset in {countdown}</span>
                    </div>
                )}
            </div>

            {/* Absolute Reset Date if available */}
            {resetDisplay && (
                <div className="text-[10px] text-muted-foreground/75 font-sans">
                    Reset at {resetDisplay}
                </div>
            )}
        </div>
    );
}

function AccountQuotaCard({
    account,
    onRefresh
}: {
    account: ProviderQuotaAccount;
    onRefresh?: (name?: string) => Promise<void>;
}) {
    const [refreshing, setRefreshing] = useState(false);
    const quotas = account.quotas ?? [];

    const handleSingleRefresh = async () => {
        if (!onRefresh || refreshing) return;
        setRefreshing(true);
        try {
            await onRefresh(account.account);
        } finally {
            setRefreshing(false);
        }
    };

    const exhaustedCount = quotas.filter(
        (q) => (q.percentageValue ?? 100) <= 5 || q.status === "exhausted"
    ).length;
    const healthyCount = quotas.length - exhaustedCount;

    return (
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-xs transition-all hover:shadow-sm">
            {/* Header: Provider Icon, Account Name, Badges & Refresh */}
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3.5">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-secondary/80 p-2 shadow-2xs">
                        <ProviderIcon providerId={account.provider} className="size-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm text-foreground truncate max-w-[240px] sm:max-w-md">
                                {account.account || account.provider}
                            </h3>
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-sans font-medium text-primary">
                                {account.provider}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <span>{quotas.length} models tracked</span>
                            {exhaustedCount > 0 && (
                                <span className="text-rose-500 font-medium font-mono text-[11px]">
                                    • {exhaustedCount} exhausted
                                </span>
                            )}
                            {healthyCount > 0 && (
                                <span className="text-emerald-500 font-medium font-mono text-[11px]">
                                    • {healthyCount} active
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleSingleRefresh}
                    disabled={refreshing}
                    className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                    title="Refresh this account's quota"
                >
                    <RefreshCw
                        className={cn("size-4", refreshing ? "animate-spin text-primary" : "")}
                    />
                </Button>
            </div>

            {/* Quota Items 2-Column Grid */}
            {quotas.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground font-sans">
                    No active quota limits returned for this account.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {quotas.map((quota, idx) => (
                        <QuotaItemRow key={`${quota.name}-${idx}`} quota={quota} />
                    ))}
                </div>
            )}
        </div>
    );
}

function QuotaPage() {
    const { data, isLoading, isFetching, error, refetch } = useQuota();
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const [filterProvider, setFilterProvider] = useState<string>("all");

    const handleRefresh = async (accountName?: string) => {
        setIsManualRefreshing(true);
        try {
            await refetch();
            setLastUpdated(new Date());
            toast.success(
                accountName ? `Quota refreshed for ${accountName}` : "Quota Tracker updated",
                {
                    description: "Fetched latest live limits from upstream providers."
                }
            );
        } catch {
            toast.error("Failed to refresh quotas");
        } finally {
            setIsManualRefreshing(false);
        }
    };

    if (error || (!data && !isLoading)) {
        return (
            <div className="mx-auto w-full max-w-6xl space-y-4">
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-xs text-rose-500 space-y-2">
                    <p className="font-semibold text-sm">
                        Failed to load quota & limits information
                    </p>
                    <p className="text-muted-foreground">
                        {error instanceof Error ? error.message : "Unknown error"}
                    </p>
                    <Button
                        type="button"
                        onClick={() => void handleRefresh()}
                        className="mt-2 text-xs bg-foreground text-background cursor-pointer"
                    >
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    const allProviders = data?.providers ?? [];
    const quotaAccounts = allProviders.filter((p) => p.quotas && p.quotas.length > 0);

    const providerTypes = Array.from(new Set(quotaAccounts.map((p) => p.provider)));
    const filteredAccounts =
        filterProvider === "all"
            ? quotaAccounts
            : quotaAccounts.filter((p) => p.provider === filterProvider);

    let totalLiveQuotas = 0;
    let totalExhausted = 0;
    let totalAvailable = 0;

    for (const p of quotaAccounts) {
        if (p.quotas) {
            totalLiveQuotas += p.quotas.length;
            for (const q of p.quotas) {
                if (q.status === "exhausted" || (q.percentageValue ?? 100) <= 5) {
                    totalExhausted++;
                } else {
                    totalAvailable++;
                }
            }
        }
    }

    const isSpinning = isFetching || isManualRefreshing;

    if (isLoading) {
        return <QuotaSkeleton />;
    }

    return (
        <div className="mx-auto w-full max-w-6xl flex flex-col gap-6">
            {/* Header */}
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-border/80 pb-5">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-foreground">
                            Quota Tracker
                        </h1>
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-sans font-medium text-primary">
                            Live
                        </span>
                    </div>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground font-sans leading-relaxed">
                        Real-time API quota limits and usage across your connected provider
                        accounts.
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden xl:inline-block text-xs text-muted-foreground font-mono mr-1">
                        Updated{" "}
                        {lastUpdated.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                        })}
                    </span>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRefresh()}
                        disabled={isSpinning}
                        className="h-8.5 text-xs font-medium cursor-pointer gap-1.5 border-border/80 bg-card hover:bg-secondary transition-colors shadow-2xs"
                    >
                        <RefreshCw
                            className={cn(
                                "size-3.5",
                                isSpinning ? "animate-spin text-primary" : "text-muted-foreground"
                            )}
                        />
                        <span>{isSpinning ? "Refreshing…" : "Refresh All"}</span>
                    </Button>

                    <Link
                        to="/providers"
                        className={cn(
                            buttonVariants({ size: "sm" }),
                            "h-8.5 text-xs font-semibold cursor-pointer shadow-xs gap-1.5"
                        )}
                    >
                        <Plus className="size-3.5" />
                        <span>Add Account</span>
                    </Link>
                </div>
            </header>

            {/* Top Summary Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-xl border border-border/80 bg-card p-4 flex items-center gap-3.5 shadow-xs">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Shield className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground font-sans">Active Accounts</p>
                        <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                            {quotaAccounts.length}
                        </p>
                    </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-card p-4 flex items-center gap-3.5 shadow-xs">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                        <CheckCircle2 className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground font-sans">
                            Available Model Quotas
                        </p>
                        <p className="text-xl font-bold font-mono text-emerald-500 dark:text-emerald-400 mt-0.5">
                            {totalAvailable}{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                                / {totalLiveQuotas}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-card p-4 flex items-center gap-3.5 shadow-xs">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                        <AlertCircle className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground font-sans">
                            Depleted / Exhausted
                        </p>
                        <p className="text-xl font-bold font-mono text-rose-500 dark:text-rose-400 mt-0.5">
                            {totalExhausted}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter Tabs if multiple provider types exist */}
            {providerTypes.length > 1 && (
                <div className="flex items-center gap-1.5 border-b border-border/60 pb-2 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setFilterProvider("all")}
                        className={cn(
                            "rounded-lg px-3 py-1.5 text-xs font-medium font-sans transition-colors cursor-pointer",
                            filterProvider === "all"
                                ? "bg-primary text-primary-foreground font-semibold"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                    >
                        All Providers ({quotaAccounts.length})
                    </button>
                    {providerTypes.map((type) => {
                        const count = quotaAccounts.filter((a) => a.provider === type).length;
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setFilterProvider(type)}
                                className={cn(
                                    "rounded-lg px-3 py-1.5 text-xs font-medium font-sans transition-colors cursor-pointer capitalize",
                                    filterProvider === type
                                        ? "bg-primary text-primary-foreground font-semibold"
                                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                )}
                            >
                                {type} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Quota Accounts List */}
            {filteredAccounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 p-12 text-center space-y-3 bg-card/40">
                    <div className="flex size-10 items-center justify-center rounded-full bg-secondary mx-auto text-muted-foreground">
                        <Gauge className="size-5" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                        No Live Quota Accounts Found
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Connect Google Antigravity or Codex accounts via OAuth to automatically view
                        live real-time token quotas and reset countdowns.
                    </p>
                    <Link
                        to="/providers"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:bg-primary-active transition-all shadow-xs cursor-pointer mt-2"
                    >
                        <Plus className="size-3.5" />
                        <span>Connect Antigravity Account</span>
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAccounts.map((account) => (
                        <AccountQuotaCard
                            key={account.id}
                            account={account}
                            onRefresh={handleRefresh}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
