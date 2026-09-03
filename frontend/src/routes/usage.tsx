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
        <div className="flex flex-col gap-6 font-mono">
            {/* Header */}
            <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end border-b border-border/80 pb-5">
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
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/30 p-0.5">
                        <button
                            type="button"
                            onClick={() => setActiveTab("overview")}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                                activeTab === "overview"
                                    ? "bg-foreground text-background font-semibold shadow-2xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Overview
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("details")}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                                activeTab === "details"
                                    ? "bg-foreground text-background font-semibold shadow-2xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Request Details
                        </button>
                    </div>

                    {activeTab === "overview" && (
                        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/30 p-0.5">
                            {PERIODS.map((p) => (
                                <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => setPeriod(p.value)}
                                    className={cn(
                                        "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                                        period === p.value
                                            ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                                            : "text-muted-foreground hover:text-foreground"
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
                    {/* Stat Metric Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <Card className="border-border/80 bg-card/60 p-4 shadow-2xs">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                                Total Requests
                            </span>
                            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                                {fmt(stats?.totalRequests)}
                            </div>
                            <p className="mt-1 text-[10.5px] text-muted-foreground">In selected period</p>
                        </Card>

                        <Card className="border-border/80 bg-card/60 p-4 shadow-2xs">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                                Input Tokens
                            </span>
                            <div className="mt-2 text-2xl font-bold tracking-tight text-primary">
                                {formatCompactNumber(stats?.totalPromptTokens || 0)}
                            </div>
                            <p className="mt-1 text-[10.5px] text-muted-foreground">
                                {fmt(stats?.totalPromptTokens)} raw
                            </p>
                        </Card>

                        <Card className="border-border/80 bg-card/60 p-4 shadow-2xs">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                                Cached Tokens
                            </span>
                            <div className="mt-2 text-2xl font-bold tracking-tight text-sky-500">
                                {formatCompactNumber(stats?.totalCachedTokens || 0)}
                            </div>
                            <p className="mt-1 text-[10.5px] text-muted-foreground">
                                {fmt(stats?.totalCachedTokens)} prompt read
                            </p>
                        </Card>

                        <Card className="border-border/80 bg-card/60 p-4 shadow-2xs">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                                Output Tokens
                            </span>
                            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-500">
                                {formatCompactNumber(stats?.totalCompletionTokens || 0)}
                            </div>
                            <p className="mt-1 text-[10.5px] text-muted-foreground">
                                {fmt(stats?.totalCompletionTokens)} generated
                            </p>
                        </Card>

                        <Card className="border-border/80 bg-card/60 p-4 shadow-2xs">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                                Est. Cost
                            </span>
                            <div className="mt-2 text-2xl font-bold tracking-tight text-amber-500">
                                {fmtCost(stats?.totalCost)}
                            </div>
                            <p className="mt-1 text-[10.5px] text-muted-foreground">Estimated LLM pricing</p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-xl border border-border/80 bg-card/60 shadow-2xs">
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
