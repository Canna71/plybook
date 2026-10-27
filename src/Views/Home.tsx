// Today (UX overhaul, step 3): what to do now. Openings due, puzzles, mistakes to train,
// files to continue, recent games, and a checklist on first start. Logic in models/today.ts.

import { Component, createResource, For, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import {
    IconBook,
    IconCheck,
    IconChessKnight,
    IconCircle,
    IconFileText,
} from "@tabler/icons-solidjs";
import Button from "../components/common/Button";
import { makeToast } from "../components/common/Toast";
import { counts } from "../models/repertoire";
import { ago, greeting, setupSteps } from "../models/today";
import { getSettingValue, setSettingValue } from "../models/settings";
import { profiles } from "../engine/engineprofiles";
import { listRepertoires, loadRepertoire } from "../storage/repertoire";
import { pickNextLichessPuzzle, puzzleStats } from "../storage/lichesspuzzles";
import { getHistoryGames, listPuzzles, pickPuzzle } from "../storage/db";
import { mistakesFolder } from "../storage/mistakes";
import { recentFiles } from "../storage/recent";
import { newGames } from "../online/autosync";
import { baseName, NameWithoutExtension } from "../storage/fs";
import { formatDate } from "../models/format";
import "./Home.scss";

/** A data source that may fail: the page shows it as empty instead. */
const safely =
    <T,>(load: () => Promise<T>, fallback: T) =>
    () =>
        load().catch(() => fallback);

const Home: Component = () => {
    const navigate = useNavigate();
    const now = new Date();

    const [openings] = createResource(
        safely(async () => {
            const list = await listRepertoires();
            const withCounts = await Promise.all(
                list.map(async (r) => {
                    try {
                        const loaded = await loadRepertoire(r);
                        return {
                            ...r,
                            ...counts(loaded.lines, loaded.cards, now),
                        };
                    } catch {
                        return { ...r, due: 0, new: 0 };
                    }
                }),
            );
            return {
                count: list.length,
                due: withCounts.reduce((n, r) => n + r.due, 0),
                fresh: withCounts.reduce((n, r) => n + r.new, 0),
                next:
                    withCounts.find((r) => r.due > 0) ??
                    withCounts.find((r) => r.new > 0),
            };
        }, undefined),
    );
    const [lichess] = createResource(safely(puzzleStats, undefined));
    const [mistakes] = createResource(
        safely(async () => {
            const folder = await mistakesFolder();
            return (await listPuzzles()).filter((p) =>
                p.file_path.startsWith(folder),
            ).length;
        }, 0),
    );
    const [games] = createResource(
        safely(async () => (await getHistoryGames()).slice(0, 3), []),
    );

    const recent = () => recentFiles().slice(0, 5);
    const bookPage = (path: string) =>
        getSettingValue("reader.places", {})[path]?.page;
    const openRecent = (path: string, kind: string) =>
        navigate(
            kind === "book"
                ? `/reader?path=${encodeURIComponent(path)}`
                : `/game?path=${encodeURIComponent(path)}&source=library`,
        );

    const steps = () =>
        setupSteps({
            engines: profiles()?.length ?? 0,
            accounts: getSettingValue("online.accounts", []).length,
            lichessPuzzles: lichess()?.count ?? 0,
            repertoires: openings()?.count ?? 0,
            books: recentFiles().filter((f) => f.kind === "book").length,
        });
    const showSetup = () =>
        !getSettingValue("today.hideSetup", false) &&
        steps().some((s) => !s.done);

    const trainOpenings = () => {
        const next = openings()?.next;
        navigate(
            next
                ? `/repertoire?path=${encodeURIComponent(next.filePath)}`
                : "/repertoires",
        );
    };
    const nextLichessPuzzle = async () => {
        if (!lichess()?.count) return navigate("/puzzles");
        const next = await pickNextLichessPuzzle();
        if (next) navigate(`/puzzle?source=lichess&id=${next.id}`);
        else makeToast("No new puzzle of this theme near your rating");
    };
    const trainMistakes = async () => {
        const puzzle = await pickPuzzle(await mistakesFolder());
        if (puzzle)
            navigate(`/puzzle?path=${encodeURIComponent(puzzle.file_path)}`);
        else navigate("/puzzles");
    };

    return (
        <div class="today_view">
            <header class="today-header">
                <h1>{greeting(now.getHours())}</h1>
                <p>
                    {now.toLocaleDateString(undefined, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                    })}
                </p>
            </header>

            <Show when={showSetup()}>
                <section class="today-card today-setup">
                    <div class="today-card-head">
                        <h2>Get started</h2>
                        <button
                            class="button is-small is-text"
                            onClick={() =>
                                void setSettingValue("today.hideSetup", true)
                            }
                        >
                            Hide
                        </button>
                    </div>
                    <ul>
                        <For each={steps()}>
                            {(step) => (
                                <li classList={{ done: step.done }}>
                                    {step.done ? <IconCheck /> : <IconCircle />}
                                    <div>
                                        <A href={step.route}>{step.label}</A>
                                        <span>{step.why}</span>
                                    </div>
                                </li>
                            )}
                        </For>
                    </ul>
                </section>
            </Show>

            <div class="today-tiles">
                <section class="today-card">
                    <h2>Openings</h2>
                    <Show
                        when={openings()?.count}
                        fallback={<p class="today-muted">No repertoire yet.</p>}
                    >
                        <p class="today-number">{openings()!.due}</p>
                        <p class="today-muted">
                            {openings()!.due === 1 ? "move" : "moves"} due
                            {openings()!.fresh
                                ? `, ${openings()!.fresh} new`
                                : ""}
                        </p>
                    </Show>
                    <Button
                        class={openings()?.due ? "is-primary" : ""}
                        onClick={trainOpenings}
                    >
                        {openings()?.count ? "Train" : "Set one up"}
                    </Button>
                </section>

                <section class="today-card">
                    <h2>Puzzles</h2>
                    <Show
                        when={lichess()?.count}
                        fallback={
                            <p class="today-muted">
                                Lichess puzzles not downloaded.
                            </p>
                        }
                    >
                        <p class="today-number">
                            {Math.round(lichess()!.rating)}
                        </p>
                        <p class="today-muted">
                            your puzzle rating, {lichess()!.solved} of{" "}
                            {lichess()!.attempts} solved
                        </p>
                    </Show>
                    <Button onClick={nextLichessPuzzle}>
                        {lichess()?.count ? "Next puzzle" : "Get puzzles"}
                    </Button>
                </section>

                <section class="today-card">
                    <h2>Mistakes</h2>
                    <Show
                        when={mistakes()}
                        fallback={
                            <p class="today-muted">
                                Review a game to turn its mistakes into puzzles.
                            </p>
                        }
                    >
                        <p class="today-number">{mistakes()}</p>
                        <p class="today-muted">
                            {mistakes() === 1 ? "position" : "positions"} from
                            your games
                        </p>
                    </Show>
                    <Show when={mistakes()}>
                        <Button onClick={trainMistakes}>Train</Button>
                    </Show>
                </section>
            </div>

            <div class="today-lists">
                <section class="today-card">
                    <h2>Continue</h2>
                    <Show
                        when={recent().length}
                        fallback={
                            <p class="today-muted">
                                Games, studies and books you open show up here.
                            </p>
                        }
                    >
                        <ul class="today-list">
                            <For each={recent()}>
                                {(f) => (
                                    <li
                                        onClick={() =>
                                            openRecent(f.path, f.kind)
                                        }
                                    >
                                        {f.kind === "book" ? (
                                            <IconBook />
                                        ) : (
                                            <IconFileText />
                                        )}
                                        <span class="today-list-name">
                                            {NameWithoutExtension(
                                                baseName(f.path),
                                            )}
                                        </span>
                                        <span class="today-muted">
                                            {f.kind === "book" &&
                                            bookPage(f.path)
                                                ? `p. ${bookPage(f.path)} · `
                                                : ""}
                                            {ago(f.at, Date.now())}
                                        </span>
                                    </li>
                                )}
                            </For>
                        </ul>
                    </Show>
                </section>

                <section class="today-card">
                    <h2>Recent games</h2>
                    <Show
                        when={games()?.length}
                        fallback={
                            <p class="today-muted">
                                <A href="/play">Play the engine</A> and your
                                games appear here.
                            </p>
                        }
                    >
                        <ul class="today-list">
                            <For each={games()}>
                                {(g) => (
                                    <li
                                        onClick={() =>
                                            navigate(
                                                `/game?id=${g.id}&source=history`,
                                            )
                                        }
                                    >
                                        <IconChessKnight />
                                        <span class="today-list-name">
                                            {g.whiteName || "Player"} –{" "}
                                            {g.blackName || "Engine"}
                                        </span>
                                        <span class="today-muted">
                                            {g.result || "*"} ·{" "}
                                            {formatDate(g.eventDate)}
                                        </span>
                                    </li>
                                )}
                            </For>
                        </ul>
                    </Show>
                </section>

                <Show when={newGames().length}>
                    <section class="today-card">
                        <h2>New online games</h2>
                        <ul class="today-list">
                            <For each={newGames().slice(0, 5)}>
                                {(g) => (
                                    <li
                                        onClick={() =>
                                            navigate(
                                                `/game?path=${encodeURIComponent(g.path)}&game=${g.index}&source=library`,
                                            )
                                        }
                                    >
                                        <IconChessKnight />
                                        <span class="today-list-name">
                                            {g.white} – {g.black}
                                        </span>
                                        <span class="today-muted">
                                            {g.result} ·{" "}
                                            {g.date.replaceAll(".", "-")}
                                            <Show
                                                when={g.mistakes !== undefined}
                                            >
                                                {" · "}
                                                {g.mistakes
                                                    ? `${g.mistakes} ${g.mistakes === 1 ? "mistake" : "mistakes"}`
                                                    : "no mistakes"}
                                            </Show>
                                        </span>
                                    </li>
                                )}
                            </For>
                        </ul>
                    </section>
                </Show>
            </div>
        </div>
    );
};

export default Home;
