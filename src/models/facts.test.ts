import { describe, expect, it } from "vitest";
import { factsAfterMove, factsFromFen, factsToShow } from "./facts";

const texts = (fen: string) => factsFromFen(fen).map((f) => f.text);

describe("positionFacts", () => {
    it("finds nothing in the starting position", () => {
        expect(
            factsFromFen(
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            ),
        ).toEqual([]);
    });

    it("finds an undefended piece and one attacked by a pawn", () => {
        // the black knight on e5 is attacked by the f4 pawn although it is defended
        expect(texts("4k3/8/3p4/4n3/5P2/8/8/4K3 w - - 0 1")).toContain(
            "Black's knight on e5 is attacked by a cheaper piece",
        );
        // the white rook on a4 is attacked by the bishop and nothing defends it
        expect(texts("4k3/8/8/8/R7/8/2b5/4K3 w - - 0 1")).toContain(
            "White's rook on a4 is attacked and not defended",
        );
    });

    it("finds a pin against the king", () => {
        // 1. e4 e5 2. Nf3 d6 3. Bb5+ c6? no: the knight on c6 pinned by Bb5
        const fen =
            "r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4";
        expect(texts(fen)).toContain(
            "Black's knight on c6 is pinned to its king by the bishop on b5",
        );
    });

    it("finds a knight fork of king and rook", () => {
        const fen = "r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1";
        const facts = factsFromFen(fen);
        expect(facts.map((f) => f.text)).toEqual(
            expect.arrayContaining([
                "Black is in check",
                "White's knight on c7 attacks the king and the rook",
            ]),
        );
        expect(facts.find((f) => f.kind === "fork")?.victim).toBe("black");
    });
});

describe("factsAfterMove", () => {
    it("marks what the move created", () => {
        // before: the knight on f3 is safe; after ...e4 it is attacked by a pawn
        const before =
            "rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 2";
        const after =
            "rnbqkbnr/pppp1ppp/8/8/4p3/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 3";
        const facts = factsAfterMove(before, after);
        expect(facts).toContainEqual(
            expect.objectContaining({
                text: "White's knight on f3 is attacked by a cheaper piece",
                isNew: true,
            }),
        );
    });
});

it("factsToShow hides lasting pawn facts", () => {
    const facts = [
        {
            kind: "pinned",
            victim: "black",
            key: "a",
            text: "old pawn",
            minor: true,
            isNew: false,
        },
        {
            kind: "pinned",
            victim: "black",
            key: "b",
            text: "old knight",
            isNew: false,
        },
        {
            kind: "hanging",
            victim: "white",
            key: "c",
            text: "new pawn",
            minor: true,
            isNew: true,
        },
    ] as const;
    expect(factsToShow([...facts]).map((f) => f.text)).toEqual([
        "new pawn",
        "old knight",
    ]);
});
