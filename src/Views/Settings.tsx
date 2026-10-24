import {
    Component,
    createResource,
    createSignal,
    For,
    onMount,
    Show,
} from "solid-js";
import anylogger from "anylogger";
import Button from "../components/common/Button";
import { makeErrorToast, makeToast } from "../components/common/Toast";
import { ExecutableUCIInterface } from "../engine/executableuci";
import { UCIEngine } from "../engine/uciengine";
import {
    activeProfile,
    addExternalEngine,
    EngineProfile,
    getEnginesFolder,
    listWeights,
    newProfileId,
    openEnginesFolder,
    profiles,
    refetchProfiles,
    removeProfile,
    saveProfile,
    setActiveProfile,
} from "../engine/engineprofiles";
import "./Settings.scss";
const log = anylogger("settings");

const TEST_TIMEOUT_MS = 20000;

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

/** One "Name=Value" per line; the value may itself contain "=". */
const parseOptions = (text: string) =>
    text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.includes("="))
        .map((line) => {
            const i = line.indexOf("=");
            return {
                name: line.slice(0, i).trim(),
                value: line.slice(i + 1).trim(),
            };
        })
        .filter((o) => o.name);

const parseArgs = (text: string) =>
    text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

const Settings: Component = () => {
    onMount(() => refetchProfiles());

    const [enginesFolder] = createResource(getEnginesFolder);
    const [testing, setTesting] = createSignal<string>();

    // #region profile editor
    const [editing, setEditing] = createSignal<EngineProfile>();
    const [argsText, setArgsText] = createSignal("");
    const [optionsText, setOptionsText] = createSignal("");

    const edit = (profile: EngineProfile) => {
        setEditing({ ...profile });
        setArgsText(profile.args.join("\n"));
        setOptionsText(
            profile.options.map((o) => `${o.name}=${o.value}`).join("\n"),
        );
    };

    const updateEditing = (changes: Partial<EngineProfile>) =>
        setEditing((p) => (p ? { ...p, ...changes } : p));

    const saveEditing = async () => {
        const p = editing();
        if (!p) return;
        try {
            await saveProfile({
                ...p,
                args: parseArgs(argsText()),
                options: parseOptions(optionsText()),
            });
            setEditing(undefined);
        } catch (err) {
            makeErrorToast(errorText(err));
        }
    };
    // #endregion

    // #region maia
    const [maiaOpen, setMaiaOpen] = createSignal(false);
    const [maiaBase, setMaiaBase] = createSignal("");
    const [maiaWeights, setMaiaWeights] = createSignal("");
    const [weights, { refetch: refetchWeights }] = createResource(listWeights, {
        initialValue: [],
    });

    const openMaia = async () => {
        const files = await refetchWeights();
        setMaiaWeights(files?.[0] ?? "");
        // never guess: a net handed to another engine (Stockfish) just makes it exit
        const lc0 = profiles().find((p) => /lc0|leela/i.test(p.name));
        setMaiaBase(lc0?.id ?? "");
        setMaiaOpen(true);
    };

    const createMaia = async () => {
        const base = profiles().find((p) => p.id === maiaBase());
        if (!base || !maiaWeights()) return;
        const net = maiaWeights().replace(/\.pb(\.gz)?$/, "");
        try {
            await saveProfile({
                ...base,
                id: newProfileId(),
                name: net,
                // Lc0 loads the net before the UCI handshake, which is what we need
                args: [`--weights={engines}/weights/${maiaWeights()}`],
                options: [],
                limitStrength: false,
                singleNode: true,
                missing: false,
            });
            setMaiaOpen(false);
            makeToast(`Added ${net}`);
        } catch (err) {
            makeErrorToast(errorText(err));
        }
    };
    // #endregion

    const addExternal = async () => {
        try {
            const added = await addExternalEngine();
            if (added) {
                makeToast(`Added ${added.name}`);
            }
        } catch (err) {
            makeErrorToast(errorText(err));
        }
    };

    const remove = async (profile: EngineProfile) => {
        try {
            await removeProfile(profile.id);
        } catch (err) {
            makeErrorToast(errorText(err));
        }
    };

    /** Starts the engine, waits for the UCI handshake and reports what it says it is. */
    const test = async (profile: EngineProfile) => {
        setTesting(profile.id);
        const uci = new ExecutableUCIInterface(profile.id, profile.name);
        const engine = new UCIEngine(uci);
        try {
            await Promise.race([
                engine.init(),
                new Promise((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(
                                    `${profile.name} did not become ready in ${TEST_TIMEOUT_MS / 1000} seconds. Lc0 needs a weights file (see the arguments of this engine).`,
                                ),
                            ),
                        TEST_TIMEOUT_MS,
                    ),
                ),
            ]);
            const id = engine.getId();
            const count = Object.keys(engine.getOptions() ?? {}).length;
            makeToast(`${id?.name ?? profile.name}: ready, ${count} options`);
        } catch (err) {
            log.error("engine test failed", err);
            makeErrorToast(errorText(err));
        } finally {
            engine.quit();
            uci.close();
            setTesting(undefined);
        }
    };

    return (
        <div class="settings_view">
            <h1 class="title is-4">Engines</h1>

            <p class="settings-help">
                Engines are UCI programs such as Stockfish or Lc0. Put them in
                the Engines folder, or add one from anywhere on your computer.
                The selected engine is used for analysis, review and playing.
            </p>

            <div class="buttons-bar">
                <Button class="is-primary" onClick={addExternal}>
                    Add engine from computer…
                </Button>
                <Button class="is-primary is-outlined" onClick={openMaia}>
                    Add Maia…
                </Button>
                <Button
                    class="is-primary is-outlined"
                    onClick={() => openEnginesFolder().catch(console.error)}
                >
                    Open Engines folder
                </Button>
            </div>
            <p class="settings-help">
                Engines folder: <code>{enginesFolder()}</code>
            </p>

            <div class="table-container">
                <table class="table is-hoverable engines-table">
                    <thead>
                        <tr>
                            <th>Use</th>
                            <th>Name</th>
                            <th>Location</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <For
                            each={profiles()}
                            fallback={
                                <tr>
                                    <td colspan="4">
                                        No engines found. Add one above.
                                    </td>
                                </tr>
                            }
                        >
                            {(profile) => (
                                <tr classList={{ missing: profile.missing }}>
                                    <td>
                                        <input
                                            type="radio"
                                            name="active-engine"
                                            disabled={profile.missing}
                                            checked={
                                                activeProfile()?.id ===
                                                profile.id
                                            }
                                            onChange={() =>
                                                setActiveProfile(profile.id)
                                            }
                                        />
                                    </td>
                                    <td>{profile.name}</td>
                                    <td class="location">
                                        {profile.external
                                            ? profile.path
                                            : `Engines/${profile.path}`}
                                        <Show when={profile.missing}>
                                            <span class="tag is-danger ml-2">
                                                missing
                                            </span>
                                        </Show>
                                        <Show when={profile.singleNode}>
                                            <span class="tag ml-2">1 node</span>
                                        </Show>
                                    </td>
                                    <td class="actions">
                                        <Button
                                            class="is-small"
                                            disabled={
                                                profile.missing ||
                                                testing() !== undefined
                                            }
                                            classList={{
                                                "is-loading":
                                                    testing() === profile.id,
                                            }}
                                            onClick={() => test(profile)}
                                        >
                                            Test
                                        </Button>
                                        <Button
                                            class="is-small"
                                            onClick={() => edit(profile)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            class="is-small is-danger is-outlined"
                                            onClick={() => remove(profile)}
                                        >
                                            Remove
                                        </Button>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>

            <Show when={maiaOpen()}>
                <div class="box settings-panel">
                    <h2 class="title is-5">Add a Maia engine</h2>
                    <p class="settings-help">
                        Maia is a set of neural nets that play like humans of a
                        given rating, run by Lc0. Add Lc0 first (for example
                        with Homebrew: <code>brew install lc0</code>, then "Add
                        engine from computer…"). Download a Maia net (for
                        example maia-1500.pb.gz) and put it in the{" "}
                        <code>weights</code> folder inside the Engines folder.
                    </p>
                    <div class="field">
                        <label class="label">Lc0 engine</label>
                        <div class="select">
                            <select
                                value={maiaBase()}
                                onChange={(e) =>
                                    setMaiaBase(e.currentTarget.value)
                                }
                            >
                                <option
                                    value=""
                                    disabled
                                    selected={!maiaBase()}
                                >
                                    Choose the Lc0 engine…
                                </option>
                                <For each={profiles()}>
                                    {(p) => (
                                        <option
                                            value={p.id}
                                            selected={p.id === maiaBase()}
                                        >
                                            {p.name}
                                        </option>
                                    )}
                                </For>
                            </select>
                        </div>
                    </div>
                    <div class="field">
                        <label class="label">Net</label>
                        <Show
                            when={weights().length > 0}
                            fallback={
                                <p class="settings-help">
                                    No nets found in the weights folder yet.
                                </p>
                            }
                        >
                            <div class="select">
                                <select
                                    value={maiaWeights()}
                                    onChange={(e) =>
                                        setMaiaWeights(e.currentTarget.value)
                                    }
                                >
                                    <For each={weights()}>
                                        {(w) => (
                                            <option
                                                value={w}
                                                selected={w === maiaWeights()}
                                            >
                                                {w}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                        </Show>
                    </div>
                    <div class="buttons">
                        <Button
                            class="is-primary"
                            disabled={!maiaBase() || !maiaWeights()}
                            onClick={createMaia}
                        >
                            Add
                        </Button>
                        <Button onClick={() => refetchWeights()}>
                            Rescan nets
                        </Button>
                        <Button onClick={() => setMaiaOpen(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </Show>

            <Show when={editing()}>
                {(profile) => (
                    <div class="box settings-panel">
                        <h2 class="title is-5">Edit engine</h2>
                        <div class="field">
                            <label class="label">Name</label>
                            <input
                                class="input"
                                value={profile().name}
                                onInput={(e) =>
                                    updateEditing({
                                        name: e.currentTarget.value,
                                    })
                                }
                            />
                        </div>
                        <div class="field">
                            <label class="label">
                                Arguments (one per line)
                            </label>
                            <textarea
                                class="textarea"
                                rows="3"
                                value={argsText()}
                                onInput={(e) =>
                                    setArgsText(e.currentTarget.value)
                                }
                            />
                            <p class="help">
                                <code>{"{engines}"}</code> stands for the
                                Engines folder, e.g.{" "}
                                <code>
                                    --weights={"{engines}"}/weights/x.pb.gz
                                </code>
                            </p>
                        </div>
                        <div class="field">
                            <label class="label">
                                UCI options (Name=Value, one per line)
                            </label>
                            <textarea
                                class="textarea"
                                rows="3"
                                value={optionsText()}
                                onInput={(e) =>
                                    setOptionsText(e.currentTarget.value)
                                }
                            />
                        </div>
                        <div class="field">
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    checked={profile().limitStrength}
                                    onChange={(e) =>
                                        updateEditing({
                                            limitStrength:
                                                e.currentTarget.checked,
                                        })
                                    }
                                />{" "}
                                Limit strength with UCI_Elo (Stockfish yes, Lc0
                                and Maia no)
                            </label>
                        </div>
                        <div class="field">
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    checked={profile().singleNode}
                                    onChange={(e) =>
                                        updateEditing({
                                            singleNode: e.currentTarget.checked,
                                        })
                                    }
                                />{" "}
                                Search a single node (the net's first choice,
                                for Maia)
                            </label>
                        </div>
                        <div class="buttons">
                            <Button class="is-primary" onClick={saveEditing}>
                                Save
                            </Button>
                            <Button onClick={() => setEditing(undefined)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </Show>
        </div>
    );
};

export default Settings;
