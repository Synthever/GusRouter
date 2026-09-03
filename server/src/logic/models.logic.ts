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
        return this.MergeComboModels(this.MergeCustomModels(MergedWithFallback, Provider));
    }

    private static MergeStaticFallbackModels(
        Models: ModelObject[],
        ProviderFilter?: string
    ): ModelObject[] {
        const existing = new Set(Models.map((m) => m.id.toLowerCase()));
        const result = [...Models];

        // Static catalog models for known providers when providers aren't connected or live discovery returns empty
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
                alias: "kr",
                models: [
                    { id: "claude-opus-5" },
                    { id: "claude-opus-5-thinking" },
                    { id: "claude-opus-5-agentic" },
                    { id: "claude-opus-5-thinking-agentic" },
                    { id: "claude-opus-4.8" },
                    { id: "claude-opus-4.8-thinking" },
                    { id: "claude-opus-4.8-agentic" },
                    { id: "claude-opus-4.8-thinking-agentic" },
                    { id: "claude-opus-4.7" },
                    { id: "claude-opus-4.7-thinking" },
                    { id: "claude-opus-4.7-agentic" },
                    { id: "claude-opus-4.7-thinking-agentic" },
                    { id: "claude-opus-4.5" },
                    { id: "claude-opus-4.5-thinking" },
                    { id: "claude-opus-4.5-agentic" },
                    { id: "claude-opus-4.5-thinking-agentic" },
                    { id: "claude-sonnet-5" },
                    { id: "claude-sonnet-5-thinking" },
                    { id: "claude-sonnet-5-agentic" },
                    { id: "claude-sonnet-5-thinking-agentic" },
                    { id: "claude-sonnet-4.5" },
                    { id: "claude-sonnet-4.5-thinking" },
                    { id: "claude-sonnet-4.5-agentic" },
                    { id: "claude-sonnet-4.5-thinking-agentic" },
                    { id: "claude-haiku-4.5" },
                    { id: "claude-haiku-4.5-thinking" },
                    { id: "claude-haiku-4.5-agentic" },
                    { id: "claude-haiku-4.5-thinking-agentic" },
                    { id: "deepseek-3.2" },
                    { id: "qwen3-coder-next" },
                    { id: "glm-5" },
                    { id: "MiniMax-M2.5" },
                    { id: "gpt-5.6-sol" },
                    { id: "gpt-5.6-sol-thinking" },
                    { id: "gpt-5.6-sol-agentic" },
                    { id: "gpt-5.6-sol-thinking-agentic" },
                    { id: "gpt-5.6-terra" },
                    { id: "gpt-5.6-terra-thinking" },
                    { id: "gpt-5.6-terra-agentic" },
                    { id: "gpt-5.6-terra-thinking-agentic" },
                    { id: "gpt-5.6-luna" },
                    { id: "gpt-5.6-luna-thinking" },
                    { id: "gpt-5.6-luna-agentic" },
                    { id: "gpt-5.6-luna-thinking-agentic" }
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
            },
            {
                alias: "cx",
                models: [
                    { id: "gpt-5.4" },
                    { id: "gpt-5.4-mini" },
                    { id: "gpt-5.3-codex" },
                    { id: "gpt-5.3-codex-spark" },
                    { id: "gpt-5.2-codex" },
                    { id: "gpt-5.1-codex" },
                    { id: "gpt-5.1-codex-mini" },
                    { id: "gpt-5.1-codex-max" }
                ]
            },
            {
                alias: "claude",
                models: [
                    { id: "claude-sonnet-5" },
                    { id: "claude-sonnet-5-thinking" },
                    { id: "claude-opus-5" },
                    { id: "claude-opus-5-thinking" },
                    { id: "claude-haiku-4.5" },
                    { id: "claude-haiku-4.5-thinking" },
                    { id: "claude-3-7-sonnet-20250219" },
                    { id: "claude-3-5-sonnet-20241022" },
                    { id: "claude-3-5-haiku-20241022" }
                ]
            },
            {
                alias: "codebuddy",
                models: [
                    { id: "gpt-5.5" },
                    { id: "gpt-5.4" },
                    { id: "gpt-5.3-codex" },
                    { id: "gpt-5.1-codex" },
                    { id: "gpt-5.1-codex-mini" },
                    { id: "gemini-3.1-pro" },
                    { id: "gemini-3.5-flash" },
                    { id: "gemini-3.0-flash" },
                    { id: "gemini-2.5-pro" },
                    { id: "gemini-2.5-flash" },
                    { id: "gemini-3.1-flash-lite" },
                    { id: "deepseek-v3" },
                    { id: "deepseek-v4-pro" },
                    { id: "deepseek-v4-flash" },
                    { id: "glm-5.3" },
                    { id: "glm-5.2" },
                    { id: "minimax-m3" },
                    { id: "kimi-k3" },
                    { id: "kimi-k2.7" }
                ]
            },
            {
                alias: "zen",
                models: [
                    { id: "big-pickle" },
                    { id: "laguna-s-2.1-free" },
                    { id: "nemotron-3.5-lightning-free" },
                    { id: "nemotron-3-ultra-free" },
                    { id: "mimo-v2.5-free" }
                ]
            },
            {
                alias: "bai",
                models: [
                    { id: "deepseek-v4-flash" },
                    { id: "deepseek-v4-flash-vision-exp" },
                    { id: "mimo-v2.5" },
                    { id: "qwen3.8-flash" }
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
