import { Component, createEffect, createSignal, Show } from "solid-js";
import Button from "../common/Button";
import { makeErrorToast, makeToast } from "../common/Toast";
import { setSettingValue } from "../../models/settings";
import {
    configureModel,
    forgetModel,
    ModelProvider,
    modelName,
    modelStatus,
    rephrase,
} from "../../storage/model";

const SAMPLE =
    "Nf3 is the engine's choice. It develops the knight. It stops Qxf7#. Then Nc6 Bc4.";

/**
 * The optional model that words explanations as a coach would (P2.4b). The provider, endpoint
 * and key go to the keychain together; this page learns only whether a key is saved.
 */
const ExplanationModel: Component = () => {
    const [provider, setProvider] = createSignal<ModelProvider | "">("");
    const [url, setUrl] = createSignal("http://localhost:11434/v1");
    const [key, setKey] = createSignal("");
    const [model, setModel] = createSignal("");
    const [busy, setBusy] = createSignal(false);
    const [sample, setSample] = createSignal<string>();

    // the form starts from what is saved, once (saving reloads the status: the form keeps
    // what was typed)
    let filled = false;
    createEffect(() => {
        const s = modelStatus();
        if (filled || !s?.provider) return;
        filled = true;
        setProvider(s.provider);
        if (s.url) setUrl(s.url);
        setModel(modelName(s.provider));
    });
    const pick = (p: ModelProvider | "") => {
        setProvider(p);
        if (p) setModel(modelName(p));
    };

    const save = async (e: Event) => {
        e.preventDefault();
        const p = provider();
        if (!p) return;
        const name = model().trim();
        setBusy(true);
        try {
            await configureModel(
                p,
                p === "openai" ? url() : undefined,
                key() || undefined,
            );
            filled = true;
            await setSettingValue(
                p === "anthropic"
                    ? "explain.anthropicModel"
                    : "explain.openaiModel",
                name,
            );
            setKey("");
            makeToast("Saved; the key is in the keychain");
        } catch (err) {
            makeErrorToast(String(err));
        } finally {
            setBusy(false);
        }
    };

    const tryIt = async () => {
        setBusy(true);
        setSample(undefined);
        try {
            setSample(await rephrase(SAMPLE));
        } catch (err) {
            makeErrorToast(String(err));
        } finally {
            setBusy(false);
        }
    };

    const forget = async () => {
        await forgetModel();
        setProvider("");
        setSample(undefined);
    };

    const saved = () => modelStatus()?.provider;
    const keyNeeded = () =>
        provider() === "anthropic" ||
        (provider() === "openai" &&
            !/^http:\/\/(localhost|127\.0\.0\.1)/.test(url()));

    return (
        <section class="settings-section">
            <h2 class="title is-4">Explanations</h2>
            <p class="settings-help">
                Plybook explains moves from the engine and chess rules. A
                language model can put an explanation as a coach would ("Say it
                as a coach" under an explanation), from the explanation and its
                evidence: the engine's lines and the facts behind it. Its text
                is thrown away if it names a move or square that is not in them.
                Optional; nothing is sent until you ask.
            </p>
            <form onSubmit={save}>
                <div class="field">
                    <label class="label is-small">Model provider</label>
                    <div class="select is-small">
                        <select
                            value={provider()}
                            onChange={(e) =>
                                pick(
                                    e.currentTarget.value as ModelProvider | "",
                                )
                            }
                        >
                            <option value="">None</option>
                            <option value="anthropic">
                                Anthropic (Claude)
                            </option>
                            <option value="openai">
                                OpenAI-compatible (Ollama, LM Studio, hosted)
                            </option>
                        </select>
                    </div>
                </div>
                <Show when={provider()}>
                    <Show when={provider() === "openai"}>
                        <div class="field">
                            <label class="label is-small">Endpoint</label>
                            <input
                                class="input is-small"
                                value={url()}
                                onInput={(e) => setUrl(e.currentTarget.value)}
                                placeholder="http://localhost:11434/v1"
                            />
                            <p class="help">
                                Ollama: http://localhost:11434/v1 · LM Studio:
                                http://localhost:1234/v1 · hosted services:
                                their https address. Changing it needs the key
                                again.
                            </p>
                        </div>
                    </Show>
                    <div class="field">
                        <label class="label is-small">Model</label>
                        <input
                            class="input is-small"
                            value={model()}
                            onInput={(e) => setModel(e.currentTarget.value)}
                            placeholder={
                                provider() === "anthropic"
                                    ? "claude-opus-5-5"
                                    : "llama3.1"
                            }
                        />
                        <Show when={provider() === "anthropic"}>
                            <p class="help">
                                claude-opus-5-5 by default. claude-haiku-5-5
                                costs far less ($0.10 per million input tokens
                                against $4) and is likely enough for rewording.
                            </p>
                        </Show>
                    </div>
                    <Show when={keyNeeded()}>
                        <div class="field">
                            <label class="label is-small">API key</label>
                            <input
                                class="input is-small"
                                type="password"
                                autocomplete="off"
                                value={key()}
                                onInput={(e) => setKey(e.currentTarget.value)}
                                placeholder={
                                    saved() === provider() &&
                                    modelStatus()?.hasKey
                                        ? "Saved in the keychain (leave empty to keep it)"
                                        : provider() === "anthropic"
                                          ? "sk-ant-…"
                                          : "Key"
                                }
                            />
                        </div>
                    </Show>
                    <div class="buttons mt-3">
                        <button
                            class={`button is-primary is-small ${busy() ? "is-loading" : ""}`}
                            type="submit"
                            disabled={busy() || !model().trim()}
                        >
                            Save
                        </button>
                        <Show when={saved()}>
                            <Button
                                class="is-small"
                                type="button"
                                disabled={busy()}
                                onClick={tryIt}
                            >
                                Try it
                            </Button>
                            <Button
                                class="is-small is-danger is-outlined"
                                type="button"
                                onClick={forget}
                            >
                                Forget
                            </Button>
                        </Show>
                    </div>
                </Show>
            </form>
            <Show when={sample()}>
                <div class="box mt-3">
                    <p class="settings-help">{SAMPLE}</p>
                    <p>{sample()}</p>
                </div>
            </Show>
        </section>
    );
};

export default ExplanationModel;
