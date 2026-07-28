import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function createClient(): Anthropic {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }

  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }

  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    client ??= createClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
