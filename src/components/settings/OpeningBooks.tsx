import { Component, createResource, For, Show } from "solid-js";
import Button from "../common/Button";
import { makeErrorToast, makeToast } from "../common/Toast";
import { getSettingValue, setSettingValue } from "../../models/settings";
import {
    ENGINE_BOOK_SETTING,
    importBook,
    listBooks,
    removeBook,
} from "../../storage/books";

/** Polyglot opening books: for the explorer and for the engine's openings when playing. */
const OpeningBooks: Component = () => {
    const [books, { refetch }] = createResource(listBooks);

    const add = async () => {
        try {
            const name = await importBook();
            if (name) {
                makeToast(`${name} added`);
                refetch();
            }
        } catch (err) {
            makeErrorToast(String(err));
        }
    };

    const remove = async (name: string) => {
        await removeBook(name);
        if (getSettingValue(ENGINE_BOOK_SETTING, "") === name) {
            await setSettingValue(ENGINE_BOOK_SETTING, "");
        }
        refetch();
    };

    return (
        <section class="settings-section">
            <h2 class="title is-4">Opening books</h2>
            <p class="settings-help">
                Polyglot books (.bin) show their moves in the Explorer tab, and
                the engine can play from one when you play against it (Playing
                Settings). ReChess cannot ship books; add the ones you have.
            </p>
            <Show when={(books()?.length ?? 0) > 0}>
                <table class="table is-narrow">
                    <tbody>
                        <For each={books()}>
                            {(name) => (
                                <tr>
                                    <td>{name}</td>
                                    <td>
                                        <Button
                                            class="is-small is-danger is-outlined"
                                            onClick={() => remove(name)}
                                        >
                                            Remove
                                        </Button>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </Show>
            <Button class="is-primary" onClick={add}>
                Import book…
            </Button>
        </section>
    );
};

export default OpeningBooks;
