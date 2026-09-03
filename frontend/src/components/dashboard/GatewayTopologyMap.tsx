import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
    ReactFlow,
    Background,
    Handle,
    Position,
    ReactFlowProvider,
    useReactFlow,
    BaseEdge,
    getBezierPath,
    type Node,
    type Edge,
    type NodeProps,
    type EdgeProps,
    BackgroundVariant
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
    Zap,
    Boxes,
    ExternalLink,
    X,
    Maximize2,
    ZoomIn,
    ZoomOut,
    Orbit,
    Workflow,
    Play
} from "lucide-react";
import { useCatalog } from "@/hooks/useCatalog";
import { useTokenSaver } from "@/hooks/useTokenSaver";
import { ProviderIcon } from "@/components/ProviderIcon";
import { api, getGatewayBaseUrl } from "@/lib/api";
import { isProviderConnected, getConnectedCount } from "@/utils/provider.utils";
import type { RequestLogEntry } from "@srouter/types";
import type { ListResponse } from "@/lib/types";

type SelectedNodeInfo = {
    type: "core" | "provider";
    id: string;
    data: Record<string, any>;
};

// Particles along active electric beams
const KAME_PARTICLE_COUNT = 6;
const SPARK_COUNT = 5;

// ==========================================
// 1. CENTRAL GUSROUTER CORE HUB NODE (9Router style + GusRouter theme)
// ==========================================
function CentralCoreHubNode({ data, selected }: NodeProps) {
    const isTokenSaverActive = Boolean(data.tokenSaverEnabled);
    const hasActiveTraffic = Boolean(data.hasActiveTraffic);
    const activeCount = Number(data.activeCount || 0);

    return (
        <div
            className={`group relative rounded-xl border-2 px-5 py-3.5 font-mono text-left min-w-[200px] shadow-md transition-all duration-300 cursor-pointer ${
                hasActiveTraffic
                    ? "topology-router-core bg-gradient-to-br from-primary/30 via-yellow-400/20 to-cyan-400/25 border-yellow-300 ring-2 ring-yellow-400/40"
                    : selected
                      ? "border-foreground ring-2 ring-foreground/20 bg-card"
                      : "border-primary/80 bg-card hover:border-primary"
            }`}
        >
            {/* 4 Multi-directional handles facing North, East, South, West */}
            <Handle
                type="source"
                position={Position.Top}
                id="top"
                className="!bg-transparent !border-0 !w-0 !h-0"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                className="!bg-transparent !border-0 !w-0 !h-0"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                className="!bg-transparent !border-0 !w-0 !h-0"
            />
            <Handle
                type="source"
                position={Position.Left}
                id="left"
                className="!bg-transparent !border-0 !w-0 !h-0"
            />

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors shadow-2xs ${
                            hasActiveTraffic
                                ? "border-yellow-300/80 bg-yellow-400/20 text-yellow-300"
                                : "border-primary/40 bg-primary/10 text-primary"
                        }`}
                    >
                        <Zap
                            className={`size-4.5 ${hasActiveTraffic ? "topology-router-icon animate-pulse" : ""}`}
                            strokeWidth={2}
                        />
                    </div>
                    <div className="min-w-0">
                        <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Central Hub
                        </span>
                        <h3 className={`text-xs font-bold truncate ${hasActiveTraffic ? "topology-router-label text-yellow-300" : "text-foreground"}`}>
                            GusRouter Core
                        </h3>
                    </div>
                </div>

                {hasActiveTraffic ? (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-yellow-400 text-black text-xs font-bold topology-router-badge">
                        {activeCount > 0 ? activeCount : "LIVE"}
                    </span>
                ) : (
                    <span className="rounded border border-border/80 bg-secondary/80 px-1.5 py-0.5 text-[8.5px] font-mono font-bold text-muted-foreground">
                        GATEWAY
                    </span>
                )}
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-[9.5px]">
                <span className="text-muted-foreground">Token Saver:</span>
                <span className={`font-semibold ${isTokenSaverActive ? "text-primary" : "text-muted-foreground"}`}>
                    {isTokenSaverActive ? "Active" : "Bypassed"}
                </span>
            </div>
        </div>
    );
}

// ==========================================
// 2. ORBITING PROVIDER NODE (9Router clean pill / card style)
// ==========================================
function OrbitProviderNode({ data, selected }: NodeProps) {
    const id = (data.id as string) || "provider";
    const name = (data.name as string) || "Provider";
    const isOnline = Boolean(data.isOnline);
    const isReceivingRequest = Boolean(data.isReceivingRequest);
    const lastLatency = typeof data.lastLatency === "number" ? data.lastLatency : null;

    return (
        <div
            className={`group relative rounded-xl border bg-card px-3.5 py-2.5 font-mono text-left min-w-[160px] max-w-[220px] shadow-2xs transition-all duration-300 cursor-pointer ${
                selected
                    ? "border-foreground ring-2 ring-foreground/20"
                    : isReceivingRequest
                      ? "border-cyan-400 bg-card shadow-[0_0_20px_rgba(34,211,238,0.4)] ring-2 ring-cyan-400/50"
                      : isOnline
                        ? "border-border/90 hover:border-foreground/40"
                        : "border-border/50 opacity-70 hover:opacity-100"
            }`}
        >
            <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0" />
            <Handle type="target" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0" />
            <Handle type="target" position={Position.Left} id="left" className="!bg-transparent !border-0 !w-0 !h-0" />
            <Handle type="target" position={Position.Right} id="right" className="!bg-transparent !border-0 !w-0 !h-0" />

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className={`flex size-7 shrink-0 items-center justify-center rounded-md border p-1 transition-colors ${
                            isReceivingRequest
                                ? "border-cyan-400/60 bg-cyan-400/10"
                                : "border-border/80 bg-secondary/50"
                        }`}
                    >
                        <ProviderIcon providerId={id} className="size-4" />
                    </div>
                    <div className="min-w-0">
                        <span className="block text-[11px] font-bold text-foreground truncate" title={name}>
                            {name}
                        </span>
                        <span className="block text-[8.5px] text-muted-foreground uppercase truncate">
                            {id}
                        </span>
                    </div>
                </div>

                {isReceivingRequest ? (
                    <span className="relative flex size-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-2 bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                    </span>
                ) : (
                    <span
                        className={`size-1.5 rounded-full shrink-0 ${
                            isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                        }`}
                        title={isOnline ? "Connected" : "Standby"}
                    />
                )}
            </div>

            {isReceivingRequest && lastLatency !== null && (
                <div className="mt-1.5 flex justify-end">
                    <span className="rounded bg-cyan-400/15 border border-cyan-400/30 px-1 py-0.2 text-[8px] font-mono font-bold text-cyan-400">
                        {lastLatency}ms
                    </span>
                </div>
            )}
        </div>
    );
}

// ==========================================
// 3. ELECTRIC KAME BEAM EDGE (From 9Router)
// ==========================================
function TopologyElectricEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    data
}: EdgeProps) {
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition
    });
    const active = Boolean(data?.active);
    const isOnline = Boolean(data?.isOnline);
    const filterId = `topo-electric-${id}`;

    if (!active) {
        return (
            <BaseEdge
                id={id}
                path={edgePath}
                style={{
                    stroke: isOnline ? "oklch(0.55 0 0)" : "oklch(0.35 0 0)",
                    strokeWidth: isOnline ? 1.5 : 1,
                    opacity: isOnline ? 0.65 : 0.25,
                    ...style
                }}
            />
        );
    }

    return (
        <g className="topology-edge-electric">
            <defs>
                <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.9"
                        numOctaves={2}
                        seed={2}
                        result="noise"
                    >
                        <animate
                            attributeName="baseFrequency"
                            values="0.8;1.4;0.8"
                            dur="0.25s"
                            repeatCount="indefinite"
                        />
                    </feTurbulence>
                    <feDisplacementMap
                        in="SourceGraphic"
                        in2="noise"
                        scale="3.5"
                        xChannelSelector="R"
                        yChannelSelector="G"
                    />
                </filter>
            </defs>

            {/* Outer electric halo */}
            <path
                d={edgePath}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={9}
                strokeOpacity={0.35}
                strokeLinecap="round"
                filter={`url(#${filterId})`}
                className="topology-edge-halo"
            />

            {/* Mid plasma */}
            <path
                d={edgePath}
                fill="none"
                stroke="#4ade80"
                strokeWidth={4.5}
                strokeOpacity={0.85}
                strokeLinecap="round"
                filter={`url(#${filterId})`}
                className="topology-edge-plasma"
            />

            {/* Hot white core */}
            <BaseEdge
                id={id}
                path={edgePath}
                style={{ stroke: "#f8fafc", strokeWidth: 2, opacity: 1 }}
                className="topology-edge-kame"
            />

            {/* Energy orbs */}
            {Array.from({ length: KAME_PARTICLE_COUNT }, (_, i) => (
                <circle
                    key={`${id}-p-${i}`}
                    r={i % 2 === 0 ? 3.5 : 2}
                    fill={i % 3 === 0 ? "#fde047" : i % 3 === 1 ? "#67e8f9" : "#fff"}
                    opacity={0.95}
                    style={{ filter: "drop-shadow(0 0 4px #22d3ee)" }}
                >
                    <animateMotion
                        dur={`${0.4 + i * 0.08}s`}
                        repeatCount="indefinite"
                        path={edgePath}
                        begin={`${i * 0.09}s`}
                    />
                </circle>
            ))}

            {/* Electric sparks */}
            {Array.from({ length: SPARK_COUNT }, (_, i) => (
                <circle key={`${id}-s-${i}`} r={1.5} fill="#e0f2fe" opacity={0}>
                    <animate
                        attributeName="opacity"
                        values="0;1;0;0;1;0"
                        dur={`${0.35 + (i % 3) * 0.1}s`}
                        begin={`${i * 0.07}s`}
                        repeatCount="indefinite"
                    />
                    <animateMotion
                        dur={`${0.28 + i * 0.05}s`}
                        repeatCount="indefinite"
                        path={edgePath}
                        begin={`${i * 0.11}s`}
                    />
                </circle>
            ))}
        </g>
    );
}

const nodeTypes = {
    centralCore: CentralCoreHubNode,
    orbitProvider: OrbitProviderNode
};

const edgeTypes = {
    topology: TopologyElectricEdge
};

// ==========================================
// TACTICAL INSPECTOR DRAWER
// ==========================================
function NodeDetailInspector({
    selectedNode,
    onClose,
    tokenSaverSettings,
    onTriggerTestRequest
}: {
    selectedNode: SelectedNodeInfo | null;
    onClose: () => void;
    tokenSaverSettings: any;
    onTriggerTestRequest?: (providerId: string) => void;
}) {
    if (!selectedNode) return null;

    const apiBase = getGatewayBaseUrl();

    return (
        <aside
            aria-label="Node Inspector"
            className="absolute right-3 top-3 bottom-3 z-30 w-80 max-w-[calc(100%-1.5rem)] rounded-xl border border-border/90 bg-card p-4 font-mono shadow-lg flex flex-col justify-between overflow-hidden"
        >
            <div>
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                            Node Telemetry
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                        title="Close Inspector"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>

                <div className="mt-3.5 space-y-3 overflow-y-auto max-h-[260px] pr-1">
                    {selectedNode.type === "core" && (
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Zap className="size-3.5 text-foreground" />
                                <span className="text-xs font-bold text-foreground">
                                    GusRouter Core Gateway
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                High-speed proxy middleware hub dispatching requests directly to surrounding upstream providers.
                            </p>

                            <div className="space-y-1.5 rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-[10.5px]">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Base Gateway URL:</span>
                                    <code className="text-foreground font-bold text-[10px] truncate max-w-[120px]">
                                        {apiBase}
                                    </code>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Token Compression:</span>
                                    <span className="font-semibold text-foreground">
                                        {tokenSaverSettings?.enabled ? "Active" : "Disabled"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Circuit Breaker:</span>
                                    <span className="font-semibold text-emerald-500">Nominal</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Overhead Latency:</span>
                                    <span className="font-semibold text-foreground">&lt; 1.2ms</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedNode.type === "provider" && (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ProviderIcon
                                        providerId={selectedNode.data.id || "provider"}
                                        className="size-3.5"
                                    />
                                    <span className="text-xs font-bold text-foreground">
                                        {selectedNode.data.name || "Provider Node"}
                                    </span>
                                </div>
                                {onTriggerTestRequest && (
                                    <button
                                        type="button"
                                        onClick={() => onTriggerTestRequest(selectedNode.data.id)}
                                        className="inline-flex items-center gap-1 rounded border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold text-cyan-400 hover:bg-cyan-400/20 transition-colors cursor-pointer"
                                        title="Simulate 5-Second Energy Beam"
                                    >
                                        <Play className="size-2.5" />
                                        <span>Ping (5s)</span>
                                    </button>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Upstream inference endpoint orbiting the central gateway core.
                            </p>

                            <div className="space-y-1.5 rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-[10.5px]">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status:</span>
                                    <span className="font-bold text-foreground capitalize">
                                        {selectedNode.data.isOnline ? "Connected & Online" : "Standby"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Connected Keys:</span>
                                    <span className="font-bold text-foreground">
                                        {selectedNode.data.count ?? 0}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Supported Models:</span>
                                    <span className="font-bold text-foreground">
                                        {selectedNode.data.modelCount ?? 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-3 border-t border-border/60">
                {selectedNode.type === "core" ? (
                    <Link
                        to="/token-saver"
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border/80 bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                    >
                        <span>Configure Token Saver</span>
                        <ExternalLink className="size-3 text-muted-foreground" />
                    </Link>
                ) : (
                    <Link
                        to="/providers/$providerId"
                        params={{ providerId: selectedNode.data.id }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border/80 bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                    >
                        <span>Provider Settings</span>
                        <ExternalLink className="size-3 text-muted-foreground" />
                    </Link>
                )}
            </div>
        </aside>
    );
}

// ==========================================
// CANVAS CONTROLS & AUTO-CENTER COMPONENT
// ==========================================
function AutoCenterOnMount({ providerCount }: { providerCount: number }) {
    const { fitView } = useReactFlow();

    useEffect(() => {
        const timer1 = setTimeout(() => {
            fitView({ padding: 0.2, duration: 250 });
        }, 50);
        const timer2 = setTimeout(() => {
            fitView({ padding: 0.2 });
        }, 250);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [fitView, providerCount]);

    return null;
}

function CanvasControls() {
    const { zoomIn, zoomOut, fitView } = useReactFlow();

    return (
        <div className="absolute left-3 bottom-3 z-20 flex items-center gap-1 rounded-lg border border-border/80 bg-card p-1 shadow-xs font-mono">
            <button
                type="button"
                onClick={() => fitView({ padding: 0.2, duration: 300 })}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                title="Fit & Center View"
            >
                <Maximize2 className="size-3" />
            </button>
            <div className="h-3 w-px bg-border/60" />
            <button
                type="button"
                onClick={() => zoomIn({ duration: 250 })}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                title="Zoom In"
            >
                <ZoomIn className="size-3" />
            </button>
            <button
                type="button"
                onClick={() => zoomOut({ duration: 250 })}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                title="Zoom Out"
            >
                <ZoomOut className="size-3" />
            </button>
        </div>
    );
}

// ==========================================
// MAIN TOPOLOGY CANVAS
// ==========================================
function GatewayTopologyCanvas() {
    const { allProviders = [] } = useCatalog();
    const { settings: tokenSaverSettings } = useTokenSaver();
    const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);

    // Fetch live logs every 3 seconds
    const { data: logsData } = useQuery<ListResponse<RequestLogEntry>>({
        queryKey: ["topology-logs"],
        queryFn: () => api.get<ListResponse<RequestLogEntry>>("/v1/logs?pageSize=20"),
        refetchInterval: 3000
    });

    // Store active 5-second pulse states per provider: { [providerId]: { latency, expiresAt } }
    const [activePings, setActivePings] = useState<Record<string, { latency: number; expiresAt: number }>>({});
    const seenLogIdsRef = useRef<Set<string>>(new Set());
    const isFirstMountRef = useRef(true);

    // Watch for new incoming request logs and trigger instant 5-second pulse
    useEffect(() => {
        if (!logsData?.data) return;

        const logs = logsData.data;
        const now = Date.now();
        const newPings: Record<string, { latency: number; expiresAt: number }> = {};
        let hasNew = false;

        if (isFirstMountRef.current) {
            isFirstMountRef.current = false;
            for (const log of logs) {
                seenLogIdsRef.current.add(log.id);
                if (now - log.createdAt < 3000) {
                    const normId = log.providerId.toLowerCase();
                    newPings[normId] = {
                        latency: log.latencyMs,
                        expiresAt: log.createdAt + 5000
                    };
                    hasNew = true;
                }
            }
        } else {
            for (const log of logs) {
                if (!seenLogIdsRef.current.has(log.id)) {
                    seenLogIdsRef.current.add(log.id);
                    const normId = log.providerId.toLowerCase();
                    newPings[normId] = {
                        latency: log.latencyMs,
                        expiresAt: log.createdAt + 5000
                    };
                    hasNew = true;
                }
            }
        }

        if (hasNew) {
            setActivePings((prev) => ({ ...prev, ...newPings }));
        }
    }, [logsData]);

    // Fast-tick timer to prune expired pings every 250ms
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setActivePings((prev) => {
                let hasExpired = false;
                const next: Record<string, { latency: number; expiresAt: number }> = {};
                for (const [id, item] of Object.entries(prev)) {
                    if (item.expiresAt > now) {
                        next[id] = item;
                    } else {
                        hasExpired = true;
                    }
                }
                return hasExpired ? next : prev;
            });
        }, 250);
        return () => clearInterval(interval);
    }, []);

    const activeProviderIdsSet = useMemo(() => {
        return new Set(Object.keys(activePings));
    }, [activePings]);

    const hasAnyActiveTraffic = activeProviderIdsSet.size > 0;

    // All connected providers + ensure opencode_zen is always present
    const connectedProviders = useMemo(() => {
        const list = allProviders.filter(
            (p) =>
                p.id === "opencode_zen" ||
                p.id === "opencode" ||
                (!p.requires_api_key && !p.requires_oauth) ||
                isProviderConnected(p) ||
                (p.status?.connectedCount ?? 0) > 0 ||
                p.status?.state === "connected" ||
                (p.connections && p.connections.length > 0)
        );

        const hasOpenCode = list.some((p) => p.id === "opencode_zen" || p.id === "opencode");
        if (!hasOpenCode) {
            const zen = allProviders.find((p) => p.id === "opencode_zen" || p.id === "opencode");
            if (zen) list.push(zen);
        }

        return list;
    }, [allProviders]);

    const displayedProviders = useMemo(() => {
        if (connectedProviders.length > 0) {
            return connectedProviders;
        }
        return allProviders.slice(0, 8);
    }, [connectedProviders, allProviders]);

    const triggerTestRequest = useCallback((providerId: string) => {
        setActivePings((prev) => ({
            ...prev,
            [providerId.toLowerCase()]: {
                latency: Math.floor(Math.random() * 150 + 50),
                expiresAt: Date.now() + 5000
            }
        }));
    }, []);

    // Build the 9Router-like Radial Constellation Layout
    const { nodes, edges } = useMemo(() => {
        const nodeList: Node[] = [];
        const edgeList: Edge[] = [];

        const nodeW = 180;
        const nodeH = 44;
        const routerW = 200;
        const routerH = 64;
        const nodeGap = 24;

        const count = displayedProviders.length;

        // Central GusRouter Hub
        nodeList.push({
            id: "router",
            type: "centralCore",
            position: { x: -routerW / 2, y: -routerH / 2 },
            data: {
                tokenSaverEnabled: tokenSaverSettings?.enabled,
                hasActiveTraffic: hasAnyActiveTraffic,
                activeCount: activeProviderIdsSet.size
            }
        });

        if (count === 0) {
            return { nodes: nodeList, edges: edgeList };
        }

        // Elliptical layout calculation
        const minRx = ((nodeW + nodeGap) * count) / (2 * Math.PI);
        const rx = Math.max(340, minRx);
        const ry = Math.max(200, rx * 0.58);

        displayedProviders.forEach((provider, i) => {
            const nodeId = `provider-${provider.id}`;
            const isZen =
                provider.id === "opencode_zen" ||
                provider.id === "opencode" ||
                (!provider.requires_api_key && !provider.requires_oauth);
            const isOnline = isZen || isProviderConnected(provider);
            const connCount = getConnectedCount(provider) || (isZen ? 1 : 0);
            const activeTraffic = activePings[provider.id.toLowerCase()];
            const isReceivingRequest = Boolean(activeTraffic);

            // Distribute evenly starting from top (-pi/2) clockwise
            const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
            const cx = rx * Math.cos(angle);
            const cy = ry * Math.sin(angle);

            let sourceHandle = "right";
            let targetHandle = "left";

            if (Math.abs(angle + Math.PI / 2) < Math.PI / 4 || Math.abs(angle - (3 * Math.PI) / 2) < Math.PI / 4) {
                sourceHandle = "top";
                targetHandle = "bottom";
            } else if (Math.abs(angle - Math.PI / 2) < Math.PI / 4) {
                sourceHandle = "bottom";
                targetHandle = "top";
            } else if (cx > 0) {
                sourceHandle = "right";
                targetHandle = "left";
            } else {
                sourceHandle = "left";
                targetHandle = "right";
            }

            nodeList.push({
                id: nodeId,
                type: "orbitProvider",
                position: { x: cx - nodeW / 2, y: cy - nodeH / 2 },
                data: {
                    id: provider.id,
                    name: provider.name,
                    status: provider.status?.state,
                    isOnline,
                    isReceivingRequest,
                    lastLatency: activeTraffic?.latency,
                    count: connCount,
                    modelCount: provider.models?.length ?? 0
                }
            });

            edgeList.push({
                id: `edge-core-${provider.id}`,
                type: "topology",
                source: "router",
                sourceHandle,
                target: nodeId,
                targetHandle,
                animated: false,
                data: {
                    active: isReceivingRequest,
                    isOnline
                }
            });
        });

        return { nodes: nodeList, edges: edgeList };
    }, [displayedProviders, tokenSaverSettings?.enabled, activePings, hasAnyActiveTraffic, activeProviderIdsSet]);

    const handleNodeClick = useCallback((_: any, node: Node) => {
        let nodeType: SelectedNodeInfo["type"] = "core";
        if (node.type === "orbitProvider") nodeType = "provider";

        setSelectedNode({
            type: nodeType,
            id: node.id,
            data: node.data
        });
    }, []);

    const handlePaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    return (
        <section
            aria-label="Gateway Architecture Topology"
            className="rounded-xl border border-border/80 bg-card/60 p-4 font-mono shadow-2xs relative"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-md border border-border/70 bg-secondary/50 text-foreground shadow-2xs">
                        <Orbit className="size-3.5" strokeWidth={1.75} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xs font-bold text-foreground">
                                Mesh routing topology
                            </h2>
                            {hasAnyActiveTraffic && (
                                <span className="flex items-center gap-1 rounded bg-yellow-400/15 border border-yellow-400/40 px-1.5 py-0.2 text-[9px] font-mono text-yellow-400 font-bold">
                                    <span className="size-1.5 rounded-full bg-yellow-400 animate-ping" />
                                    ROUTING TRAFFIC
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Real-time electric constellation of GusRouter Core dispatching directly to upstream inference endpoints.
                        </p>
                    </div>
                </div>
            </div>

            {/* View Body */}
            <div className="h-[500px] w-full rounded-lg border border-border/60 bg-background/50 overflow-hidden relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodeClick={handleNodeClick}
                    onPaneClick={handlePaneClick}
                    fitView
                    fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
                    proOptions={{ hideAttribution: true }}
                    minZoom={0.15}
                    maxZoom={1.8}
                >
                    <Background
                        variant={BackgroundVariant.Dots}
                        gap={16}
                        size={1}
                        color="var(--border, #52525b)"
                    />
                    <CanvasControls />
                    <AutoCenterOnMount providerCount={displayedProviders.length} />
                </ReactFlow>

                <NodeDetailInspector
                    selectedNode={selectedNode}
                    onClose={() => setSelectedNode(null)}
                    tokenSaverSettings={tokenSaverSettings}
                    onTriggerTestRequest={triggerTestRequest}
                />
            </div>
        </section>
    );
}

export function GatewayTopologyMap() {
    return (
        <ReactFlowProvider>
            <GatewayTopologyCanvas />
        </ReactFlowProvider>
    );
}
