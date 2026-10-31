// Help (U.5): the user guide, docs/GUIDE.md, bundled with the app so it works offline. Contents
// on the left, the sections on the right; `?section=<screen id>` opens a screen's own section
// (the "?" in each screen's header, and F1).

import {
    Component,
    createEffect,
    createResource,
    createSignal,
    For,
    on,
    Show,
} from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { getVersion } from "@tauri-apps/api/app";
import showdown from "showdown";
import DOMPurify from "dompurify";
import guideText from "../../docs/GUIDE.md?raw";
import PageHeader from "../components/shell/PageHeader";
import { makeErrorToast } from "../components/common/Toast";
import {
    GuideSection,
    parseGuide,
    searchGuide,
    sectionOfLink,
    withoutImages,
} from "../models/guide";
import { openSite } from "../storage/sites";
import "./Help.scss";

const guide = parseGuide(guideText);
// lists nested by two spaces, as GitHub reads them
const converter = new showdown.Converter({
    tables: true,
    disableForced4SpacesIndentedSublists: true,
});
// the guide is ours, but everything set as innerHTML is sanitized all the same
const html = (markdown: string) =>
    DOMPurify.sanitize(converter.makeHtml(withoutImages(markdown)));
const rendered = new Map(guide.sections.map((s) => [s.id, html(s.body)]));
const intro = html(guide.intro);

const Help: Component = () => {
    const [params, setParams] = useSearchParams<{ section?: string }>();
    const [query, setQuery] = createSignal("");
    // the app's version (F.12), as Settings → Updates shows it
    const [version] = createResource(() => getVersion());
    const shown = () => searchGuide(guide, query());

    let article: HTMLElement | undefined;

    const show = (s: GuideSection) => {
        setQuery("");
        setParams({ section: s.id });
    };

    // the section asked for, at the top
    createEffect(
        on(
            () => params.section,
            (id) => {
                const el = id ? article?.querySelector(`#help-${id}`) : null;
                if (el) el.scrollIntoView({ block: "start" });
                else article?.scrollTo({ top: 0 });
            },
        ),
    );

    // what a search finds, from its first match
    createEffect(
        on(
            query,
            (q) => {
                if (q) article?.scrollTo({ top: 0 });
            },
            { defer: true },
        ),
    );

    // links: to another section here, or a web page in the site window (I.5)
    const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest("a");
        const href = a?.getAttribute("href");
        if (!href) return;
        e.preventDefault();
        const section = sectionOfLink(guide, href);
        if (section) show(section);
        else if (href.startsWith("https://"))
            openSite(href).catch((err) => makeErrorToast(String(err)));
    };

    return (
        <div class="help_view">
            <PageHeader
                title="Help"
                description={`Plybook ${version() ?? ""}: how to use each screen. Most screens have a ? button in their header that opens their part of this guide; F1 does it from anywhere.`}
            />
            <div class="help-layout">
                <nav class="help-contents" aria-label="Contents">
                    <input
                        class="input is-small"
                        type="search"
                        placeholder="Search the guide"
                        value={query()}
                        onInput={(e) => setQuery(e.currentTarget.value)}
                    />
                    <ul>
                        <For each={guide.sections}>
                            {(s) => (
                                <li>
                                    <a
                                        href={`#help-${s.id}`}
                                        classList={{
                                            "is-active":
                                                params.section === s.id,
                                            "is-dimmed":
                                                !!query() &&
                                                !shown().includes(s),
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            show(s);
                                        }}
                                    >
                                        {s.title}
                                    </a>
                                </li>
                            )}
                        </For>
                    </ul>
                </nav>
                <article
                    class="help-article content"
                    ref={article}
                    onClick={onClick}
                >
                    <Show when={!query()}>
                        <div innerHTML={intro} />
                    </Show>
                    <For
                        each={shown()}
                        fallback={
                            <p class="help-none">
                                Nothing in the guide matches “{query()}”.
                            </p>
                        }
                    >
                        {(s) => (
                            <section
                                id={`help-${s.id}`}
                                classList={{
                                    "is-active": params.section === s.id,
                                }}
                            >
                                <h2>{s.title}</h2>
                                <div innerHTML={rendered.get(s.id)} />
                            </section>
                        )}
                    </For>
                </article>
            </div>
        </div>
    );
};

export default Help;
