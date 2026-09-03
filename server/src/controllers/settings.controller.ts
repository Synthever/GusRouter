import type { Context } from "hono";
import {
    addCustomModelDB,
    createFallbackRuleDB,
    getAllSettingsDB,
    getRequireApiKeyDB,
    setRequireApiKeyDB,
    setSettingDB,
    upsertAPIKeyDB,
    upsertProviderDB
} from "@srouter/db";
import { UpdateSettingsSchema } from "@srouter/types";
import { Err, Ok } from "@/utils/response.js";
import { loadSavedProvidersFromDB } from "@/services/registry.js";

export class SettingsController {
    public static GetSettings(c: Context): Response {
        return Ok(c, {
            require_api_key: getRequireApiKeyDB(),
            requireApiKey: getRequireApiKeyDB(),
            settings: getAllSettingsDB()
        });
    }

    public static async UpdateSettings(c: Context): Promise<Response> {
        const RawBody = await c.req.json().catch(() => null);
        const Parsed = UpdateSettingsSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid settings payload", 400);
        }

        try {
            if (typeof Parsed.data.require_api_key === "boolean") {
                setRequireApiKeyDB(Parsed.data.require_api_key);
            }
            if (Parsed.data.settings) {
                for (const [key, value] of Object.entries(Parsed.data.settings)) {
                    if (typeof value === "string") {
                        setSettingDB(key, value);
                    }
                }
            }

            return Ok(c, {
                message: "Settings updated successfully",
                require_api_key: getRequireApiKeyDB(),
                requireApiKey: getRequireApiKeyDB(),
                settings: getAllSettingsDB()
            });
        } catch (error) {
            return Err(
                c,
                error instanceof Error ? error.message : "Failed to update settings",
                500
            );
        }
    }

    public static async ImportBackup(c: Context): Promise<Response> {
        const payload = await c.req.json().catch(() => null);
        if (!payload || typeof payload !== "object") {
            return Err(c, "Invalid JSON payload", 400);
        }

        const stats = {
            connectionsImported: 0,
            apiKeysImported: 0,
            combosImported: 0,
            customModelsImported: 0,
            settingsImported: false
        };

        try {
            // 1. Import System Settings if present
            if (payload.settings && typeof payload.settings === "object") {
                if (typeof payload.settings.requireApiKey === "boolean") {
                    setRequireApiKeyDB(payload.settings.requireApiKey);
                } else if (typeof payload.settings.require_api_key === "boolean") {
                    setRequireApiKeyDB(payload.settings.require_api_key);
                }

                for (const [key, value] of Object.entries(payload.settings)) {
                    if (typeof value === "string") {
                        setSettingDB(key, value);
                    } else if (typeof value === "object" && value !== null) {
                        setSettingDB(key, JSON.stringify(value));
                    }
                }
                stats.settingsImported = true;
            }

            // 2. Import Provider Connections
            const connections = Array.isArray(payload.providerConnections)
                ? payload.providerConnections
                : Array.isArray(payload.connections)
                  ? payload.connections
                  : [];

            for (const conn of connections) {
                if (!conn || typeof conn !== "object") continue;
                const id = conn.id;
                const rawProvider = conn.provider || conn.providerId || "custom";
                let providerId = rawProvider === "openai_codex" ? "openai_codex" : rawProvider;
                if (providerId === "codex") {
                    providerId = "openai_codex";
                }
                const name = conn.name || conn.email || providerId;
                const category = conn.authType === "oauth" ? "oauth" : (conn.category || "api_key");
                const protocol = conn.protocol || "openai";
                const enabled = conn.isActive !== undefined ? Boolean(conn.isActive) : (conn.enabled !== undefined ? Boolean(conn.enabled) : true);
                const createdAt = conn.createdAt ? (typeof conn.createdAt === "string" ? new Date(conn.createdAt).getTime() : Number(conn.createdAt)) : Date.now();

                upsertProviderDB({
                    id,
                    providerId,
                    name,
                    category,
                    protocol,
                    base_url: conn.baseUrl || conn.base_url || undefined,
                    apiKey: conn.apiKey || undefined,
                    accessToken: conn.accessToken || undefined,
                    refreshToken: conn.refreshToken || undefined,
                    accountId: conn.accountId || conn.account_id || undefined,
                    organizationId: conn.organizationId || conn.organization_id || undefined,
                    tokenExpiresAt: conn.expiresAt ? (typeof conn.expiresAt === "string" ? new Date(conn.expiresAt).getTime() : Number(conn.expiresAt)) : undefined,
                    lastRefreshedAt: conn.lastRefreshAt ? (typeof conn.lastRefreshAt === "string" ? new Date(conn.lastRefreshAt).getTime() : Number(conn.lastRefreshAt)) : undefined,
                    customHeaders: conn.customHeaders || undefined,
                    providerSpecificData: conn.providerSpecificData || undefined,
                    enabled,
                    createdAt: isNaN(createdAt) ? Date.now() : createdAt
                });
                stats.connectionsImported++;
            }

            // 3. Import Provider Nodes (e.g. Bai or custom openai-compatible nodes)
            if (Array.isArray(payload.providerNodes)) {
                for (const node of payload.providerNodes) {
                    if (!node || !node.id) continue;
                    upsertProviderDB({
                        id: node.id,
                        providerId: node.prefix || node.id,
                        name: node.name || node.prefix || "Custom Node",
                        category: "custom_provider",
                        protocol: "openai",
                        base_url: node.baseUrl || undefined,
                        enabled: true,
                        createdAt: node.createdAt ? new Date(node.createdAt).getTime() : Date.now()
                    });
                    stats.connectionsImported++;
                }
            }

            // 4. Import API Keys
            if (Array.isArray(payload.apiKeys)) {
                for (const k of payload.apiKeys) {
                    if (!k || typeof k !== "object") continue;
                    const createdAt = k.createdAt ? (typeof k.createdAt === "string" ? new Date(k.createdAt).getTime() : Number(k.createdAt)) : Date.now();
                    upsertAPIKeyDB({
                        id: k.id,
                        key: k.key,
                        name: k.name || "API Key",
                        enabled: k.isActive !== undefined ? Boolean(k.isActive) : (k.enabled !== undefined ? Boolean(k.enabled) : true),
                        rate_limit: k.rate_limit ?? k.rateLimit ?? 0,
                        quota_limit: k.quota_limit ?? k.quotaLimit ?? 0,
                        credit_limit: k.credit_limit ?? k.creditLimit ?? 0,
                        usage_tokens: k.usage_tokens ?? k.usageTokens ?? 0,
                        usage_cost: k.usage_cost ?? k.usageCost ?? 0,
                        allowed_models: Array.isArray(k.allowed_models) ? k.allowed_models : (Array.isArray(k.allowedModels) ? k.allowedModels : null),
                        created_at: isNaN(createdAt) ? Date.now() : createdAt
                    });
                    stats.apiKeysImported++;
                }
            }

            // 5. Import Combos into fallback_rules
            if (Array.isArray(payload.combos)) {
                for (const combo of payload.combos) {
                    if (!combo || !combo.name || !Array.isArray(combo.models)) continue;
                    const models: string[] = combo.models;
                    if (models.length === 0) continue;

                    // Source is combo.name, target models prioritized 1..N
                    for (let idx = 0; idx < models.length; idx++) {
                        createFallbackRuleDB({
                            sourceModel: combo.name,
                            targetModel: models[idx],
                            priority: idx + 1,
                            enabled: true,
                            maxRetries: 1
                        });
                        stats.combosImported++;
                    }
                }
            }

            // 6. Import Custom Models
            if (Array.isArray(payload.customModels)) {
                for (const cm of payload.customModels) {
                    if (!cm || typeof cm !== "object") continue;
                    const providerAlias = cm.providerAlias || cm.providerId;
                    const modelId = cm.id || cm.name;
                    if (providerAlias && modelId) {
                        try {
                            addCustomModelDB(providerAlias, modelId);
                            stats.customModelsImported++;
                        } catch {
                            // ignore duplicate primary key
                        }
                    }
                }
            }

            // Reload provider registry after database update
            loadSavedProvidersFromDB();

            return Ok(c, {
                message: "Backup imported successfully",
                stats
            });
        } catch (error) {
            console.error("Failed to import backup payload:", error);
            return Err(
                c,
                error instanceof Error ? error.message : "Failed to import backup data",
                500
            );
        }
    }
}
