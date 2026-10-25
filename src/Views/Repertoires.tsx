import { Component, createResource, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import Button from "../components/common/Button";
import { counts } from "../models/repertoire";
import {
    listRepertoires,
    loadRepertoire,
    setRepertoire,
} from "../storage/repertoire";
import { baseName, NameWithoutExtension } from "../storage/fs";
import PageHeader from "../components/shell/PageHeader";
import "./Repertoires.scss";

/** The user's repertoires with what is due, to train or edit. */
const Repertoires: Component = () => {
    const navigate = useNavigate();
    const [repertoires, { refetch }] = createResource(async () => {
        const now = new Date();
        return Promise.all(
            (await listRepertoires()).map(async (r) => {
                try {
                    const loaded = await loadRepertoire(r);
                    return { ...r, ...counts(loaded.lines, loaded.cards, now) };
                } catch {
                    // the file was moved or deleted
                    return { ...r, due: 0, new: 0, missing: true };
                }
            }),
        );
    });

    const open = (route: string, filePath: string) =>
        navigate(`${route}?path=${encodeURIComponent(filePath)}`);

    const forget = async (filePath: string) => {
        await setRepertoire(filePath);
        refetch();
    };

    return (
        <div class="repertoires_view">
            <PageHeader
                title="Repertoires"
                description={
                    'A repertoire is a PGN file in your Library with your lines and the opponent\'s replies as variations. Open the file and choose "Repertoire for White" or "for Black" in its toolbar; then train it here. Moves come back on a spaced-repetition schedule.'
                }
            />
            <table class="table is-fullwidth is-narrow">
                <tbody>
                    <For
                        each={repertoires()}
                        fallback={
                            <tr>
                                <td>No repertoires yet.</td>
                            </tr>
                        }
                    >
                        {(r) => (
                            <tr>
                                <td>
                                    <strong>
                                        {NameWithoutExtension(
                                            baseName(r.filePath),
                                        )}
                                    </strong>
                                </td>
                                <td>{r.side}</td>
                                <td>
                                    <Show
                                        when={!("missing" in r)}
                                        fallback="file not found"
                                    >
                                        {r.due} to review · {r.new} new
                                    </Show>
                                </td>
                                <td class="actions">
                                    <Button
                                        class="is-small is-primary"
                                        disabled={"missing" in r}
                                        onClick={() =>
                                            open("/repertoire", r.filePath)
                                        }
                                    >
                                        Train
                                    </Button>
                                    <Button
                                        class="is-small"
                                        disabled={"missing" in r}
                                        onClick={() =>
                                            open("/game", r.filePath)
                                        }
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        class="is-small is-danger is-outlined"
                                        title="Stop training this file; the file is kept"
                                        onClick={() => forget(r.filePath)}
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
    );
};

export default Repertoires;
