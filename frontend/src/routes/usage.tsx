import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Boxes,
    ChevronDown,
    ChevronRight,
    Coins,
    CircleDollarSign,
    Clock,
    Database,
    FileText,
    KeyRound,
    Layers,
    Search,
    Shield,
    Zap,
    X,
    Filter
} from "lucide-react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from "recharts";
import { api } from "@/lib/api";
import { cn, formatCompactNumber } from "@/lib/utils";
import type { UsagePeriodStats, RequestDetailsResponse, RequestDetailItem } from "@srouter/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogDetailSheet } from "@/components/logs/LogDetailSheet";
import { GatewayTopologyMap } from "@/components/dashboard/GatewayTopologyMap";

export const Route = createFileRoute("/usage")({
    staticData: { title: "Usage" },
    component: UsagePage
});

const PERIODS = [
    { value: "today", label: "Today" },
    { value: "24h", label: "24h" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "60d", label: "60D" }
] as const;

function fmt(n?: number) {
    return new Intl.NumberFormat().format(n || 0);
}

function fmtCost(n?: number) {
    return `$${(n || 0).toFixed(4)}`;
}

function fmtTime(ts?: number | null) {
    if (!ts) return "Never";
    const diffMins = Math.floor((Date.now() - ts) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return new Date(ts).toLocaleDateString();
}

function UsagePage() {
    const [activeTab, setActiveTab] = useState<"overview" | "details">("overview");
    const [period, setPeriod] = useState<string>("today");

    // Details tab filter states
    const [detailsPage, setDetailsPage] = useState(1);
    const [providerFilter, setProviderFilter] = useState("");
    const [modelSearch, setModelSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedLog, setSelectedLog] = useState<any | null>(null);

    // Grouping & view mode for Overview table
    const [groupBy, setGroupBy] = useState<"model" | "provider" | "apiKey">("model");
    const [viewMode, setViewMode] = useState<"tokens" | "cost">("tokens");
    const [tableSearch, setTableSearch] = useState("");

    // Fetch Overview Stats
    const { data: stats, isLoading: isStatsLoading } = useQuery<UsagePeriodStats>({
        queryKey: ["usage-stats", period],
        queryFn: () => api.get<UsagePeriodStats>(`/v1/usage/stats?period=${period}`),
        refetchInterval: 30000
    });

    // Fetch Details Data
    const queryParams = new URLSearchParams({
        page: detailsPage.toString(),
        pageSize: "20"
    });
    if (providerFilter) queryParams.append("provider", providerFilter);
    if (modelSearch) queryParams.append("model", modelSearch);
    if (statusFilter !== "all") queryParams.append("status", statusFilter);
    if (startDate) queryParams.append("startDate", startDate);
    if (endDate) queryParams.append("endDate", endDate);

    const { data: detailsData, isLoading: isDetailsLoading } = useQuery<RequestDetailsResponse>({
        queryKey: ["usage-details", detailsPage, providerFilter, modelSearch, statusFilter, startDate, endDate],
        queryFn: () => api.get<RequestDetailsResponse>(`/v1/usage/details?${queryParams.toString()}`),
        enabled: activeTab === "details"
    });

    // Overview table data source
    const tableData = useMemo(() => {
        if (!stats) return [];
        let list: any[] = [];
        if (groupBy === "model") {
            list = stats.byModel || [];
        } else if (groupBy === "provider") {
            list = stats.byProvider || [];
        } else {
            list = stats.byApiKey || [];
        }

        const q = tableSearch.toLowerCase().trim();
        if (!q) return list;

        return list.filter((item) => {
            const name = item.model || item.providerId || item.apiKeyName || item.apiKeyId || "";
            return name.toLowerCase().includes(q);
        });
    }, [stats, groupBy, tableSearch]);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 font-mono">
            {/* Header */}
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-border/80 pb-5">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                        Observability & Telemetry
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
                        Usage
                    </h1>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                        Track gateway token consumption, model invocation costs, and granular request audit history.
                    </p>
                </div>

                {/* Tab Switcher & Period Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
                    {/* View Switcher: Overview / Request Details */}
                    <div className="grid grid-cols-2 sm:flex items-center gap-1 rounded-xl border border-border/70 bg-secondary/40 p-1 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab("overview")}
                            className={cn(
                                "flex items-center justify-center px-4 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                                activeTab === "overview"
                                    ? "bg-foreground text-background shadow-xs font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Overview
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("details")}
                            className={cn(
                                "flex items-center justify-center px-4 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                                activeTab === "details"
                                    ? "bg-foreground text-background shadow-xs font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Details
                        </button>
                    </div>

                    {/* Time Range Filter */}
                    {activeTab === "overview" && (
                        <div className="grid grid-cols-5 sm:flex items-center gap-1 rounded-xl border border-border/70 bg-secondary/40 p-1 w-full sm:w-auto overflow-x-auto">
                            {PERIODS.map((p) => (
                                <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => setPeriod(p.value)}
                                    className={cn(
                                        "flex items-center justify-center px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer text-center",
                                        period === p.value
                                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                                    )}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            {activeTab === "overview" && (
                <>
                    {/* Stat Metric Cards (Full width vertical stack on mobile, 5-col on desktop) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                        <Card className="flex flex-col justify-between border-border/80 bg-card/70 p-4 sm:p-5 rounded-2xl shadow-2xs">
                            <span className="text-xs sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Total Requests
                            </span>
                            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
                                {fmt(stats?.totalRequests)}
                            </div>
                        </Card>

                        <Card className="flex flex-col justify-between border-border/80 bg-card/70 p-4 sm:p-5 rounded-2xl shadow-2xs">
                            <span className="text-xs sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Total Input Tokens
                            </span>
                            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-primary font-mono truncate" title={fmt(stats?.totalPromptTokens)}>
                                {fmt(stats?.totalPromptTokens)}
                            </div>
                        </Card>

                        <Card className="flex flex-col justify-between border-border/80 bg-card/70 p-4 sm:p-5 rounded-2xl shadow-2xs">
                            <span className="text-xs sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Cached Tokens
                            </span>
                            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-sky-500 font-mono truncate" title={fmt(stats?.totalCachedTokens)}>
                                {fmt(stats?.totalCachedTokens)}
                            </div>
                        </Card>

                        <Card className="flex flex-col justify-between border-border/80 bg-card/70 p-4 sm:p-5 rounded-2xl shadow-2xs">
                            <span className="text-xs sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Output Tokens
                            </span>
                            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-emerald-500 font-mono truncate" title={fmt(stats?.totalCompletionTokens)}>
                                {fmt(stats?.totalCompletionTokens)}
                            </div>
                        </Card>

                        <Card className="flex flex-col justify-between border-border/80 bg-card/70 p-4 sm:p-5 rounded-2xl shadow-2xs">
                            <div>
                                <span className="text-xs sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Est. Cost
                                </span>
                                <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-amber-500 font-mono">
                                    ~{fmtCost(stats?.totalCost)}
                                </div>
                            </div>
                            <p className="mt-1.5 text-[10px] text-muted-foreground">Estimated, not actual billing</p>
                        </Card>
                    </div>

                    {/* Provider Topology + Recent Requests */}
                    <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                        <GatewayTopologyMap />
                        <Card className="flex min-w-0 flex-col overflow-hidden border-border/80 bg-card/70 p-4 rounded-2xl shadow-2xs" style={{ minHeight: 480, maxHeight: 520 }}>
                            <div className="flex items-center justify-between pb-2.5 border-b border-border/50 shrink-0">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Recent Requests
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                    {stats?.recentRequests?.length || 0} latest
                                </span>
                            </div>

                            {!stats?.recentRequests?.length ? (
                                <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs italic">
                                    No requests yet.
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto mt-2 pr-1 scrollbar-thin">
                                    <table className="w-full border-collapse text-xs">
                                        <thead className="sticky top-0 bg-card z-10">
                                            <tr className="border-b border-border/40 text-[10px] uppercase text-muted-foreground">
                                                <th className="py-1.5 text-left font-semibold w-3"></th>
                                                <th className="py-1.5 text-left font-semibold">Model</th>
                                                <th className="py-1.5 text-right font-semibold whitespace-nowrap">In / Out</th>
                                                <th className="py-1.5 text-right font-semibold">When</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {stats.recentRequests.map((r, i) => {
                                                const ok = !r.statusCode || (r.statusCode >= 200 && r.statusCode < 300);
                                                return (
                                                    <tr key={r.id || i} className="hover:bg-secondary/40 transition-colors">
                                                        <td className="py-2 pr-1">
                                                            <span
                                                                className={cn(
                                                                    "block w-2 h-2 rounded-full",
                                                                    ok ? "bg-emerald-500 shadow-xs shadow-emerald-500/50" : "bg-red-500 shadow-xs shadow-red-500/50"
                                                                )}
                                                            />
                                                        </td>
                                                        <td className="py-2 font-mono text-[11px] truncate max-w-[130px]" title={r.model}>
                                                            {r.model}
                                                        </td>
                                                        <td className="py-2 text-right font-mono text-[11px] whitespace-nowrap">
                                                            <span className="text-primary">{fmt(r.promptTokens)}↑</span>{" "}
                                                            <span className="text-emerald-500">{fmt(r.completionTokens)}↓</span>
                                                        </td>
                                                        <td className="py-2 text-right text-muted-foreground text-[10px] whitespace-nowrap">
                                                            {fmtTime(r.timestamp)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Chart Section */}
                    <Card className="border-border/80 bg-card/60 p-4 sm:p-5 shadow-2xs">
                        <div className="flex items-center justify-between pb-3 border-b border-border/50">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">Usage Activity Trend</h3>
                                <p className="text-[11px] text-muted-foreground">Timeline distribution across {period}</p>
                            </div>
                            <div className="flex items-center gap-1 rounded-md border border-border/60 bg-secondary/30 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("tokens")}
                                    className={cn(
                                        "px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer",
                                        viewMode === "tokens"
                                            ? "bg-foreground text-background font-semibold"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Tokens
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("cost")}
                                    className={cn(
                                        "px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer",
                                        viewMode === "cost"
                                            ? "bg-foreground text-background font-semibold"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Cost ($)
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 h-64 w-full">
                            {!stats?.chartData || stats.chartData.length === 0 || !stats.chartData.some(d => d.tokens > 0 || d.cost > 0) ? (
                                <div className="h-full flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/50 rounded-lg">
                                    No usage recorded for this timeframe.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                                        <XAxis
                                            dataKey="label"
                                            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => (viewMode === "tokens" ? formatCompactNumber(val) : `$${val}`)}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "var(--color-card)",
                                                borderColor: "var(--color-border)",
                                                borderRadius: "8px",
                                                fontSize: "12px",
                                                color: "var(--color-foreground)"
                                            }}
                                            formatter={(value: any) => [
                                                viewMode === "tokens" ? fmt(value) + " tokens" : fmtCost(value),
                                                viewMode === "tokens" ? "Tokens" : "Est. Cost"
                                            ]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey={viewMode === "tokens" ? "tokens" : "cost"}
                                            stroke={viewMode === "tokens" ? "var(--color-primary)" : "#f59e0b"}
                                            strokeWidth={2}
                                            fill={viewMode === "tokens" ? "url(#tokenGradient)" : "url(#costGradient)"}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </Card>

                    {/* Breakdown Table Section */}
                    <Card className="border-border/80 bg-card/60 overflow-hidden shadow-2xs">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-border/60 bg-secondary/20">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center rounded-lg border border-border/60 bg-secondary/40 p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setGroupBy("model")}
                                        className={cn(
                                            "px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer",
                                            groupBy === "model"
                                                ? "bg-foreground text-background font-semibold"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        By Model
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setGroupBy("provider")}
                                        className={cn(
                                            "px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer",
                                            groupBy === "provider"
                                                ? "bg-foreground text-background font-semibold"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        By Provider
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setGroupBy("apiKey")}
                                        className={cn(
                                            "px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer",
                                            groupBy === "apiKey"
                                                ? "bg-foreground text-background font-semibold"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        By API Key
                                    </button>
                                </div>
                            </div>

                            <div className="relative max-w-xs w-full">
                                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder={`Filter ${groupBy}s...`}
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    className="w-full rounded-lg border border-border/60 bg-background/50 pl-8 pr-3 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-border/60 text-muted-foreground/80 bg-secondary/10">
                                        <th className="py-2.5 px-4 text-left font-semibold">
                                            {groupBy === "model" ? "Model" : groupBy === "provider" ? "Provider" : "API Key"}
                                        </th>
                                        {groupBy === "model" && <th className="py-2.5 px-4 text-left font-semibold">Provider</th>}
                                        <th className="py-2.5 px-4 text-right font-semibold">Requests</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Input</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Cached</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Output</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Total Tokens</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Est. Cost</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Last Activity</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {tableData.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-muted-foreground">
                                                No breakdown entries recorded for this selection.
                                            </td>
                                        </tr>
                                    ) : (
                                        tableData.map((row: any, idx: number) => {
                                            const label = row.model || row.providerId || row.apiKeyName || "Direct";
                                            return (
                                                <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                                                    <td className="py-2.5 px-4 font-semibold text-foreground truncate max-w-[220px]" title={label}>
                                                        {label}
                                                    </td>
                                                    {groupBy === "model" && (
                                                        <td className="py-2.5 px-4 text-muted-foreground uppercase text-[10px]">
                                                            {row.providerId || "-"}
                                                        </td>
                                                    )}
                                                    <td className="py-2.5 px-4 text-right tabular-nums">{fmt(row.totalRequests)}</td>
                                                    <td className="py-2.5 px-4 text-right tabular-nums text-primary">{fmt(row.promptTokens)}</td>
                                                    <td className="py-2.5 px-4 text-right tabular-nums text-sky-500">{row.cachedTokens ? fmt(row.cachedTokens) : "—"}</td>
                                                    <td className="py-2.5 px-4 text-right tabular-nums text-emerald-500">{fmt(row.completionTokens)}</td>
                                                    <td className="py-2.5 px-4 text-right tabular-nums font-bold text-foreground">{fmt(row.totalTokens)}</td>
                                                    <td className="py-2.5 px-4 text-right tabular-nums text-amber-500">{fmtCost(row.estimatedCost)}</td>
                                                    <td className="py-2.5 px-4 text-right text-muted-foreground whitespace-nowrap">{fmtTime(row.lastUsedAt)}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}

            {activeTab === "details" && (
                <div className="flex flex-col gap-4">
                    {/* Filters Toolbar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 p-4 rounded-xl border border-border/80 bg-card/60 shadow-2xs">
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground block mb-1">
                                Search Model
                            </label>
                            <Input
                                type="text"
                                placeholder="e.g. claude-3-7-sonnet..."
                                value={modelSearch}
                                onChange={(e) => {
                                    setModelSearch(e.target.value);
                                    setDetailsPage(1);
                                }}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground block mb-1">
                                Status
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setDetailsPage(1);
                                }}
                                className="w-full h-8 rounded-md border border-border/60 bg-secondary/30 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                                <option value="all">All Statuses</option>
                                <option value="success">Success (2xx)</option>
                                <option value="error">Errors (4xx/5xx)</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground block mb-1">
                                Start Date
                            </label>
                            <Input
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setDetailsPage(1);
                                }}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground block mb-1">
                                End Date
                            </label>
                            <Input
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setDetailsPage(1);
                                }}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="flex items-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setModelSearch("");
                                    setProviderFilter("");
                                    setStatusFilter("all");
                                    setStartDate("");
                                    setEndDate("");
                                    setDetailsPage(1);
                                }}
                                className="h-8 w-full text-xs cursor-pointer"
                            >
                                Reset Filters
                            </Button>
                        </div>
                    </div>

                    {/* Details Table */}
                    <Card className="border-border/80 bg-card/60 overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-border/60 text-muted-foreground/80 bg-secondary/20">
                                        <th className="py-2.5 px-4 text-left font-semibold">Timestamp</th>
                                        <th className="py-2.5 px-4 text-left font-semibold">Model</th>
                                        <th className="py-2.5 px-4 text-left font-semibold">Provider</th>
                                        <th className="py-2.5 px-4 text-left font-semibold">API Key</th>
                                        <th className="py-2.5 px-4 text-center font-semibold">Status</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Latency</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Prompt</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Cached</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Output</th>
                                        <th className="py-2.5 px-4 text-right font-semibold">Cost</th>
                                        <th className="py-2.5 px-4 text-center font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {isDetailsLoading ? (
                                        <tr>
                                            <td colSpan={11} className="py-12 text-center text-muted-foreground">
                                                Loading request telemetry...
                                            </td>
                                        </tr>
                                    ) : !detailsData?.details || detailsData.details.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="py-12 text-center text-muted-foreground">
                                                No request details found matching criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        detailsData.details.map((item) => {
                                            const isOk = item.statusCode >= 200 && item.statusCode < 300;
                                            return (
                                                <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                                                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                                                        {new Date(item.timestamp).toLocaleString([], {
                                                            month: "short",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            second: "2-digit"
                                                        })}
                                                    </td>
                                                    <td className="py-2.5 px-4 font-semibold text-foreground max-w-[180px] truncate" title={item.model}>
                                                        {item.model}
                                                    </td>
                                                    <td className="py-2.5 px-4 uppercase text-[10px] text-muted-foreground">
                                                        {item.providerId}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-muted-foreground max-w-[120px] truncate" title={item.apiKeyName}>
                                                        {item.apiKeyName || "Direct"}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        <span
                                                            className={cn(
                                                                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold",
                                                                isOk
                                                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                                                    : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                                            )}
                                                        >
                                                            {item.statusCode}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                                                        {item.latencyMs}ms
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right tabular-nums text-primary">
                                                        {fmt(item.promptTokens)}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right tabular-nums text-sky-500">
                                                        {item.cachedTokens ? fmt(item.cachedTokens) : "—"}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right tabular-nums text-emerald-500">
                                                        {fmt(item.completionTokens)}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right tabular-nums text-amber-500">
                                                        {fmtCost(item.estimatedCost)}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            onClick={() => setSelectedLog(item)}
                                                            className="h-6 px-2 text-[10px] cursor-pointer"
                                                        >
                                                            Inspect
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        {detailsData && detailsData.pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between p-3 border-t border-border/60 bg-secondary/10">
                                <span className="text-[11px] text-muted-foreground">
                                    Page {detailsData.pagination.page} of {detailsData.pagination.totalPages} ({detailsData.pagination.totalItems} total requests)
                                </span>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={detailsPage <= 1}
                                        onClick={() => setDetailsPage((p) => Math.max(1, p - 1))}
                                        className="h-7 text-xs"
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={detailsPage >= detailsData.pagination.totalPages}
                                        onClick={() => setDetailsPage((p) => p + 1)}
                                        className="h-7 text-xs"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>

                    <LogDetailSheet log={selectedLog} onClose={() => setSelectedLog(null)} />
                </div>
            )}
        </div>
    );
}
