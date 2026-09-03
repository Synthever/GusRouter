import type { ProviderMetadata } from "./types.js";

export const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";

export const CLAUDE_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
export const CLAUDE_OAUTH_REDIRECT_URI = "http://localhost:1455/auth/claude/callback";
export const CLAUDE_OAUTH_SCOPE = "org:create_api_key user:profile user:inference";
export const CLAUDE_OAUTH_AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
export const CLAUDE_OAUTH_TOKEN_URL = "https://api.anthropic.com/v1/oauth/token";

export const ANTHROPIC_MODELS = [
    { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
    { id: "claude-sonnet-5-thinking", name: "Claude Sonnet 5 (Thinking)" },
    { id: "claude-opus-5", name: "Claude Opus 5" },
    { id: "claude-opus-5-thinking", name: "Claude Opus 5 (Thinking)" },
    { id: "claude-haiku-4.5", name: "Claude Haiku 4.5" },
    { id: "claude-haiku-4.5-thinking", name: "Claude Haiku 4.5 (Thinking)" },
    { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" }
];

export const ANTHROPIC_MODEL_IDS = ANTHROPIC_MODELS.map((m) => m.id);

export const ANTHROPIC_PROVIDER: ProviderMetadata = {
    id: "anthropic",
    name: "Anthropic Claude",
    category: "oauth",
    protocol: "anthropic",
    alias: "claude",
    web_url: "https://claude.ai",
    requires_api_key: false,
    requires_oauth: true,
    status_message: "OAuth token missing"
};
