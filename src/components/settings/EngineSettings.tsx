import {
    Component,
    createMemo,
    createResource,
    createSignal,
    For,
    onMount,
    Show,
} from "solid-js";
import anylogger from "anylogger";
import { getSettingValue, setSettingValue } from "../../models/settings";
import Button from "../common/Button";
import { makeErrorToast, makeToast } from "../common/Toast";
import { ExecutableUCIInterface } from "../../engine/executableuci";
import { UCIEngine } from "../../engine/uciengine";
import {
    activeProfile,
    EngineProfile,
    Executable,
    getEnginesFolder,
    HUMAN_SETTING,
    knownExecutables,
    listWeights,
    newProfileId,
    openEnginesFolder,
    pickExecutable,
    pickWeights,
    profiles,
    refetchProfiles,
    removeProfile,
    saveProfile,
    setActiveProfile,
} from "../../engine/engineprofiles";
const log = anylogger("enginesettings");

const TEST_TIMEOUT_MS = 20000;

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const netName = (path: string) => baseName(path).replace(/\.pb(\.gz)?$/, "");
const executableKey = (e: Executable) => `${e.external}:${e.path}`;
const isMaia = (net: string) => /maia/i.test(baseName(net));

type Net = { value: string; label: string };

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

const EngineSettings: Component = () => {
    onMount(() => refetchProfiles());

    const [enginesFolder] = createResource(getEnginesFolder);
    const [testing, setTesting] = createSignal<string>();

    // #region add engine
    const [addOpen, setAddOpen] = createSignal(false);
    // programs picked with the file dialog but not saved in a profile yet
    const [browsedExecutables, setBrowsedExecutables] = createSignal<
        Executable[]
    >([]);
    const [executableChoice, setExecutableChoice] = createSignal("");
    const [browsedNets, setBrowsedNets] = createSignal<Net[]>([]);
    const [selectedNets, setSelectedNets] = createSignal<string[]>([]);
    const [humanLikeChoice, setHumanLikeChoice] = createSignal<boolean>();
    const [addName, setAddName] = createSignal("");
    const [weights, { refetch: refetchWeights }] = createResource(listWeights, {
        initialValue: [],
    });

    const executables = createMemo(() => {
        const all = [...knownExecutables(profiles())];
        for (const e of browsedExecutables()) {
            if (!all.some((k) => executableKey(k) === executableKey(e))) {
                all.push(e);
            }
        }
        return all;
    });
    const chosenExecutable = () =>
        executables().find((e) => executableKey(e) === executableChoice());

    const nets = createMemo<Net[]>(() => [
        ...weights().map((w) => ({
            value: `{engines}/weights/${w}`,
            label: w,
        })),
        ...browsedNets(),
    ]);

    // Maia nets play like a human: one node, no Elo limit
    const humanLike = () =>
        humanLikeChoice() ??
        (selectedNets().length > 0 && selectedNets().every(isMaia));

    const openAdd = async () => {
        setBrowsedNets([]);
        setSelectedNets([]);
        setHumanLikeChoice(undefined);
        setAddName("");
        setExecutableChoice("");
        await refetchWeights();
        setAddOpen(true);
    };

    const browseExecutable = async () => {
        try {
            const path = await pickExecutable();
            if (!path) return;
            const executable = { path, external: true, label: path };
            setBrowsedExecutables((all) => [...all, executable]);
            setExecutableChoice(executableKey(executable));
        } catch (err) {
            makeErrorToast(errorText(err));
        }
    };

    const browseNets = async () => {
        try {
            const paths = await pickWeights();
            const added = paths.map((value) => ({
                value,
                label: baseName(value),
            }));
            setBrowsedNets((all) => [
                ...all,
                ...added.filter((a) => !all.some((n) => n.value === a.value)),
            ]);
            setSelectedNets((all) => [
                ...all,
                ...added.map((a) => a.value).filter((v) => !all.includes(v)),
            ]);
        } catch (err) {
            makeErrorToast(errorText(err));
        }
    };

    const toggleNet = (value: string, on: boolean) =>
        setSelectedNets((all) =>
            on ? [...all, value] : all.filter((v) => v !== value),
        );

    const createEngines = async () => {
        const executable = chosenExecutable();
        if (!executable) return;
        const base = {
            path: executable.path,
            external: executable.external,
            options: [],
            missing: false,
        };
        try {
            if (selectedNets().length === 0) {
                // a plain engine such as Stockfish
                await saveProfile({
                    ...base,
                    id: newProfileId(),
                    name: addName().trim() || baseName(executable.path),
                    args: [],
                    limitStrength: true,
                    singleNode: false,
                });
            } else {
                // one entry per net: Lc0 loads its net when it starts
                for (const net of selectedNets()) {
                    await saveProfile({
                        ...base,
                        id: newProfileId(),
                        name: netName(net),
                        args: [`--weights=${net}`],
                        limitStrength: false,
                        singleNode: humanLike(),
                    });
                }
            }
            makeToast("Engine added");
            setAddOpen(false);
        } catch (err) {
            makeErrorToast(errorText(err));
        }
    };
    // #endregion

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
                                    `${profile.name} did not become ready in ${TEST_TIMEOUT_MS / 1000} seconds. Lc0 needs a network (weights file) to start.`,
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
        <section class="settings-section">
            <h2 class="title is-4">Engines</h2>

            <p class="settings-help">
                Engines are UCI programs such as Stockfish or Lc0. They can live
                anywhere on your computer. The selected engine is used for
                analysis, review and playing.
            </p>

            <div class="buttons-bar">
                <Button class="is-primary" onClick={openAdd}>
                    Add engine…
                </Button>
                <Button
                    class="is-primary is-outlined"
                    onClick={() =>
                        openEnginesFolder().catch((e) => log.error(e))
                    }
                >
                    Open Engines folder
                </Button>
            </div>
            <p class="settings-help">
                Engines folder: <code>{enginesFolder()}</code>. Programs put
                there are found automatically.
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

            <div class="field human-engine">
                <label class="label">Human moves in analysis</label>
                <div class="select">
                    <select
                        value={getSettingValue<string>(HUMAN_SETTING, "")}
                        onChange={(e) =>
                            setSettingValue(
                                HUMAN_SETTING,
                                e.currentTarget.value,
                            )
                        }
                    >
                        <option value="">
                            Automatic (first human-like engine)
                        </option>
                        <option value="off">Off</option>
                        <For each={profiles().filter((p) => p.singleNode)}>
                            {(p) => <option value={p.id}>{p.name}</option>}
                        </For>
                    </select>
                </div>
                <p class="help">
                    A Maia engine runs next to the analysis and shows the moves
                    players of its rating usually choose, and when the natural
                    move is a trap.
                </p>
            </div>

            <Show when={addOpen()}>
                <div class="box settings-panel">
                    <h2 class="title is-5">Add engine</h2>

                    <div class="field">
                        <label class="label">Engine program</label>
                        <div class="field has-addons">
                            <div class="control is-expanded">
                                <div class="select is-fullwidth">
                                    <select
                                        value={executableChoice()}
                                        onChange={(e) =>
                                            setExecutableChoice(
                                                e.currentTarget.value,
                                            )
                                        }
                                    >
                                        <option
                                            value=""
                                            disabled
                                            selected={!executableChoice()}
                                        >
                                            Choose…
                                        </option>
                                        <For each={executables()}>
                                            {(e) => (
                                                <option
                                                    value={executableKey(e)}
                                                    selected={
                                                        executableKey(e) ===
                                                        executableChoice()
                                                    }
                                                >
                                                    {e.label}
                                                </option>
                                            )}
                                        </For>
                                    </select>
                                </div>
                            </div>
                            <div class="control">
                                <Button onClick={browseExecutable}>
                                    Browse…
                                </Button>
                            </div>
                        </div>
                        <p class="help">
                            Anywhere on your computer, for example{" "}
                            <code>/opt/homebrew/bin/lc0</code> (in the dialog,
                            Cmd+Shift+G types a path).
                        </p>
                    </div>

                    <div class="field">
                        <label class="label">
                            Networks (only for Lc0, e.g. Maia)
                        </label>
                        <Show
                            when={nets().length > 0}
                            fallback={
                                <p class="help">
                                    None yet. Use Browse to pick a file such as
                                    maia-1500.pb.gz, or put nets in the{" "}
                                    <code>weights</code> folder of the Engines
                                    folder.
                                </p>
                            }
                        >
                            <For each={nets()}>
                                {(net) => (
                                    <div>
                                        <label class="checkbox">
                                            <input
                                                type="checkbox"
                                                checked={selectedNets().includes(
                                                    net.value,
                                                )}
                                                onChange={(e) =>
                                                    toggleNet(
                                                        net.value,
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                            />{" "}
                                            {net.label}
                                        </label>
                                    </div>
                                )}
                            </For>
                        </Show>
                        <div class="buttons mt-2">
                            <Button class="is-small" onClick={browseNets}>
                                Browse…
                            </Button>
                            <Button
                                class="is-small"
                                onClick={() => refetchWeights()}
                            >
                                Rescan weights folder
                            </Button>
                        </div>
                        <p class="help">
                            Each network you tick becomes its own engine entry.
                        </p>
                    </div>

                    <Show
                        when={selectedNets().length > 0}
                        fallback={
                            <div class="field">
                                <label class="label">Name</label>
                                <input
                                    class="input"
                                    placeholder={
                                        chosenExecutable()
                                            ? baseName(chosenExecutable()!.path)
                                            : ""
                                    }
                                    value={addName()}
                                    onInput={(e) =>
                                        setAddName(e.currentTarget.value)
                                    }
                                />
                            </div>
                        }
                    >
                        <div class="field">
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    checked={humanLike()}
                                    onChange={(e) =>
                                        setHumanLikeChoice(
                                            e.currentTarget.checked,
                                        )
                                    }
                                />{" "}
                                Human-like play (Maia): the net's first choice,
                                no Elo limit
                            </label>
                        </div>
                    </Show>

                    <div class="buttons">
                        <Button
                            class="is-primary"
                            disabled={!chosenExecutable()}
                            onClick={createEngines}
                        >
                            Add
                        </Button>
                        <Button onClick={() => setAddOpen(false)}>
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
        </section>
    );
};

export default EngineSettings;
