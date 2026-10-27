import { invoke } from "@tauri-apps/api/core";
import { createResource, createRoot } from "solid-js";
import { getSettingValue } from "../models/settings";

// Mirrors src-tauri/src/model.rs: the model that rewords explanations (P2.4b). The provider,
// endpoint and key live in the keychain together; the webview learns whether a key is set,
// never the key.

export type ModelProvider = "anthropic" | "openai";

export type ModelStatus = {
    provider?: ModelProvider;
    url?: string;
    hasKey: boolean;
};

// one for the app, kept for its whole life
const [status, { refetch }] = createRoot(() =>
    createResource(() =>
        invoke<ModelStatus>("model_status").catch(() => undefined),
    ),
);
/** The model set up now, if any (reloads after configure and forget) */
export const modelStatus = status;

/** Saves the provider; a key left empty keeps the saved one for the same endpoint. */
export async function configureModel(
    provider: ModelProvider,
    url: string | undefined,
    key: string | undefined,
) {
    await invoke<void>("model_configure", { provider, url, key });
    await refetch();
}

export async function forgetModel() {
    await invoke<void>("model_forget");
    await refetch();
}

/** The model name for the provider, from the settings */
export const modelName = (provider: ModelProvider) =>
    provider === "anthropic"
        ? getSettingValue("explain.anthropicModel", "claude-opus-5-5")
        : getSettingValue("explain.openaiModel", "");

/** The explanation reworded by the configured model. */
export function rephrase(text: string): Promise<string> {
    const provider = modelStatus()?.provider;
    if (!provider) return Promise.reject(new Error("No model is set up"));
    return invoke<string>("model_rephrase", {
        model: modelName(provider),
        text,
    });
}
