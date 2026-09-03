import type { ModelObject } from "@srouter/types";
import { getAllCustomModelsDB, getAllFallbackRulesDB } from "@srouter/db";
import { providerAlias, providerBaseId } from "@srouter/constants";
import { registry } from "@/services/registry.js";

export class ModelsLogic {
    public static async GetAllModels(
        Provider?: string,
        ForceRefresh = false
    ): Promise<ModelObject[]> {
        const Models = await registry.listAllModels(Provider, ForceRefresh);
        const MergedWithFallback = this.MergeStaticFallbackModels(Models, Provider);
        const allModels = this.MergeComboModels(this.MergeCustomModels(MergedWithFallback, Provider));
        
        // Filter strictly to Antigravity (ag) and Qoder (qd)
        return allModels.filter((m) => {
            const id = m.id.toLowerCase();
            const owner = (m.owned_by || "").toLowerCase();
            return (
                id.startsWith("ag/") ||
                id.startsWith("qd/") ||
                id.startsWith("antigravity/") ||
                id.startsWith("qoder/") ||
                owner === "ag" ||
                owner === "qd" ||
                owner === "antigravity" ||
                owner === "qoder"
            );
        });
    }

    private static MergeStaticFallbackModels(
        Models: ModelObject[],
        ProviderFilter?: string
    ): ModelObject[] {
        const existing = new Set(Models.map((m) => m.id.toLowerCase()));
        const result = [...Models];

        // Static catalog models for Antigravity and Qoder only
        const fallbackCatalog: Array<{ alias: string; models: Array<{ id: string }> }> = [
            {
                alias: "ag",
                models: [
                    { id: "gemini-3.7-flash-high" },
                    { id: "gemini-3.7-flash-medium" },
                    { id: "gemini-3.7-flash-low" },
                    { id: "gemini-3.6-flash-high" },
                    { id: "gemini-3.6-flash-medium" },
                    { id: "gemini-3.6-flash-low" },
                    { id: "gemini-3.5-flash-high" },
                    { id: "gemini-3.5-flash-medium" },
                    { id: "gemini-3.5-flash-low" },
                    { id: "gemini-3.1-pro-high" },
                    { id: "gemini-3.1-pro-low" },
                    { id: "claude-sonnet-4-6" },
                    { id: "claude-opus-4-6-thinking" },
                    { id: "gpt-oss-120b-medium" }
                ]
            },
            {
                alias: "qd",
                models: [
                    { id: "qwen3.8-max-preview" },
                    { id: "qwen3.7-max" },
                    { id: "qwen3.7-plus" },
                    { id: "kimi-k3" },
                    { id: "kimi-k2.7-code" },
                    { id: "glm-5.2" },
                    { id: "deepseek-v4-pro" },
                    { id: "deepseek-v4-flash" },
                    { id: "minimax-m3" },
                    { id: "ultimate" },
                    { id: "auto" },
                    { id: "performance" },
                    { id: "efficient" },
                    { id: "lite" }
                ]
            }
        ];

        for (const cat of fallbackCatalog) {
            if (ProviderFilter && cat.alias.toLowerCase() !== ProviderFilter.toLowerCase()) {
                continue;
            }
            for (const m of cat.models) {
                const fullId = `${cat.alias}/${m.id}`;
                if (!existing.has(fullId.toLowerCase())) {
                    existing.add(fullId.toLowerCase());
                    result.push({
                        id: fullId,
                        object: "model",
                        owned_by: cat.alias
                    });
                }
            }
        }

        return result;
    }

    private static MergeComboModels(Models: ModelObject[]): ModelObject[] {
        const Rules = getAllFallbackRulesDB().filter((Rule) => Rule.enabled);
        if (Rules.length === 0) return Models;

        const Merged = new Map<string, ModelObject>();

        for (const Model of Models) {
            Merged.set(Model.id.toLowerCase(), Model);
        }

        const ComboModels = new Set<string>();

        for (const Rule of Rules) {
            const SourceModel = Rule.sourceModel.trim();

            if (!SourceModel || SourceModel === "*" || SourceModel.endsWith("/*")) {
                continue;
            }

            ComboModels.add(SourceModel);
        }

        for (const ComboModel of ComboModels) {
            const VirtualModelId = ComboModel.startsWith("srouter/")
                ? ComboModel
                : `srouter/${ComboModel}`;

            Merged.set(ComboModel.toLowerCase(), {
                id: VirtualModelId,
                object: "model",
                owned_by: "srouter",
                custom: true
            });
        }

        return Array.from(Merged.values());
    }

    private static MergeCustomModels(
        Models: ModelObject[],
        ProviderFilter?: string
    ): ModelObject[] {
        const Rows = getAllCustomModelsDB();
        if (Rows.length === 0) return Models;

        const Merged = new Map<string, ModelObject>();
        for (const M of Models) {
            Merged.set(M.id.toLowerCase(), M);
        }
        for (const Row of Rows) {
            // If modelId already has a slash (e.g. "kr/qwen3-coder-next"), keep it as is.
            // If not, prepend provider alias.
            let Id = Row.modelId;
            let Alias = "custom";
            if (Id.includes("/")) {
                Alias = Id.split("/")[0] || "custom";
            } else {
                Alias = providerAlias(providerBaseId(Row.providerId));
                Id = `${Alias}/${Row.modelId}`;
            }

            if (ProviderFilter && !Alias.toLowerCase().startsWith(ProviderFilter.toLowerCase())) {
                continue;
            }
            Merged.set(Id.toLowerCase(), {
                id: Id,
                object: "model",
                owned_by: Alias,
                custom: true
            });
        }
        return Array.from(Merged.values());
    }

    public static async GetModelById(
        ModelId: string,
        ForceRefresh = false
    ): Promise<ModelObject | undefined> {
        if (!ModelId) return undefined;
        const Models = await registry.listAllModels(undefined, ForceRefresh);
        const CleanId = ModelId.replace(/^srouter\//, "");

        return Models.find(
            (M) =>
                M.id.replace(/^srouter\//, "") === CleanId ||
                M.id.endsWith(`/${CleanId}`) ||
                CleanId.endsWith(`/${M.id}`)
        );
    }

    public static RefreshModels(ForceRefresh = false): Promise<ModelObject[]> {
        return registry.refreshModels(ForceRefresh);
    }

    public static ClearCache(ProviderId?: string): void {
        registry.clearModelsCache(ProviderId);
    }
}
