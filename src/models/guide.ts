// The user guide (docs/GUIDE.md, U.5) in sections, for the Help screen: each "## " heading
// starts one, named by the `<!-- help: id -->` line under it (a screen's id in
// models/navigation.ts, so a screen opens its own section). No DOM here, for tests.

export type GuideSection = {
    id: string;
    title: string;
    /** The section's Markdown, without its heading and id line */
    body: string;
    /** The heading as GitHub makes it an anchor ("Your data" → "your-data") */
    anchor: string;
};

export type Guide = { title: string; intro: string; sections: GuideSection[] };

/** GitHub's heading anchor: lower case, spaces to dashes, punctuation dropped */
export const anchorOf = (heading: string) =>
    heading
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s/g, "-");

export function parseGuide(markdown: string): Guide {
    const text = markdown.replace(/\r\n/g, "\n");
    const [head, ...parts] = text.split(/^## /m);
    const title = /^# (.+)$/m.exec(head)?.[1].trim() ?? "Help";
    const intro = head.replace(/^# .+$/m, "").trim();
    const sections = parts.map((part) => {
        const newline = part.indexOf("\n");
        const heading = (newline < 0 ? part : part.slice(0, newline)).trim();
        let body = newline < 0 ? "" : part.slice(newline + 1);
        const id = /^\s*<!--\s*help:\s*([\w-]+)\s*-->/.exec(body);
        if (id) body = body.slice(id[0].length);
        const anchor = anchorOf(heading);
        return {
            id: id?.[1] ?? anchor,
            title: heading,
            body: body.trim(),
            anchor,
        };
    });
    return { title, intro, sections };
}

/** Markdown for the app: images left out (they show the app itself, and are not bundled) */
export const withoutImages = (markdown: string) =>
    markdown.replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, "").trim();

/** The sections whose title or text holds every word of the query */
export function searchGuide(guide: Guide, query: string): GuideSection[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return guide.sections;
    return guide.sections.filter((s) => {
        const text = `${s.title}\n${s.body}`.toLowerCase();
        return words.every((w) => text.includes(w));
    });
}

/** The section a link inside the guide points at ("#your-data"), by anchor or id */
export function sectionOfLink(
    guide: Guide,
    href: string,
): GuideSection | undefined {
    if (!href.startsWith("#")) return undefined;
    const target = decodeURIComponent(href.slice(1));
    return guide.sections.find((s) => s.anchor === target || s.id === target);
}
