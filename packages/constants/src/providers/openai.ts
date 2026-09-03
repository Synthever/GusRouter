import type { ProviderMetadata } from "./types.js";

export const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex/responses";
export const CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models";

export const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const CODEX_OAUTH_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
export const CODEX_OAUTH_TOKEN_URL = "https://auth.openai.com/oauth/token";
export const CODEX_OAUTH_SCOPE =
    "openid profile email offline_access api.connectors.read api.connectors.invoke";
export const CODEX_OAUTH_REDIRECT_URI = "http://localhost:1455/auth/callback";
export const CODEX_OAUTH_ORIGINATOR = "codex_cli_rs";

export const CODEX_DEFAULT_MODELS = [
    { id: "gpt-5.4", name: "GPT 5.4" },
    { id: "gpt-5.4-mini", name: "GPT 5.4 Mini" },
    { id: "gpt-5.3-codex", name: "GPT 5.3 Codex" },
    { id: "gpt-5.3-codex-spark", name: "GPT 5.3 Codex Spark" },
    { id: "gpt-5.2-codex", name: "GPT 5.2 Codex" },
    { id: "gpt-5.1-codex", name: "GPT 5.1 Codex" },
    { id: "gpt-5.1-codex-mini", name: "GPT 5.1 Codex Mini" },
    { id: "gpt-5.1-codex-max", name: "GPT 5.1 Codex Max" }
];

export const CODEX_DEFAULT_MODEL_IDS = CODEX_DEFAULT_MODELS.map((m) => m.id);

export const OPENAI_CODEX_PROVIDER: ProviderMetadata = {
    id: "openai_codex",
    name: "OpenAI Codex / ChatGPT",
    category: "oauth",
    protocol: "openai",
    alias: "cx",
    web_url: "https://chatgpt.com",
    requires_api_key: false,
    requires_oauth: true,
    status_message: "OAuth token missing"
};
