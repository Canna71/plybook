import { describe, expect, it } from "vitest";
import { positionalReasons } from "./positional";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const texts = (fen: string, uci: string) =>
    positionalReasons(fen, uci).map((r) => `${r.good ? "+" : "-"} ${r.text}`);

describe("positionalReasons", () => {
    it("knows the opening: the centre, development, castling", () => {
        expect(texts(START, "e2e4")).toEqual(["+ takes a share of the centre"]);
        expect(texts(START, "g1f3")).toEqual(["+ develops the knight"]);
        // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5, White castles
        const italian =
            "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
        expect(texts(italian, "e1g1")).toEqual([
            "+ castles: the king is safer and a rook comes into play",
        ]);
    });

    it("does not call a capture in the centre a claim on it", () => {
        // 1.e4 d5 2.exd5
        const scandi =
            "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
        expect(texts(scandi, "e4d5")).not.toContain(
            "+ takes a share of the centre",
        );
    });

    it("puts a rook on an open file", () => {
        const fen = "3k4/p6p/8/8/8/8/P6P/R3K3 w - - 0 30";
        expect(texts(fen, "a1d1")).toContain(
            "+ puts the rook on the open d-file",
        );
    });

    it("creates and pushes passed pawns", () => {
        // the c-pawn takes on b5: no black pawn on a, b or c stops it any more
        const fen = "4k3/8/8/1p6/2P5/8/8/4K3 w - - 0 40";
        expect(texts(fen, "c4b5")).toContain("+ creates a passed pawn on b5");
        const passed = "4k3/8/8/8/2P5/8/8/4K3 w - - 0 40";
        expect(texts(passed, "c4c5")).toContain(
            "+ pushes the passed pawn to c5",
        );
    });

    it("finds an outpost for a knight", () => {
        // a knight to d5, defended by the e4 pawn, no black c- or e-pawn to chase it
        const fen = "4k3/pp3p1p/3p4/8/4P3/2N5/PP3PPP/4K3 w - - 0 20";
        expect(texts(fen, "c3d5")).toContain(
            "+ puts the knight on an outpost on d5",
        );
    });

    it("warns about the king's pawns while queens are on", () => {
        const fen = "3q2k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 25";
        expect(texts(fen, "g2g4")).toContain(
            "- weakens the pawns in front of the king",
        );
        // no queens: an endgame king does not need the shelter
        const endgame = "6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 40";
        expect(texts(endgame, "g2g4")).not.toContain(
            "- weakens the pawns in front of the king",
        );
    });

    it("notices isolated pawns, its own and the opponent's", () => {
        // cxb5 takes the a-pawn's only neighbour; White's lone pawn was isolated already
        const fen = "4k3/8/p7/1p6/2P5/8/8/4K3 w - - 0 30";
        // (b5 is not passed: the a6 pawn can still take it)
        expect(texts(fen, "c4b5")).toEqual([
            "+ leaves the opponent an isolated pawn on a6",
        ]);
        // a pawn that walks away from its neighbour isolates itself
        const pair = "4k3/8/8/8/8/8/PP6/4K3 w - - 0 30";
        expect(texts(pair, "b2b4")).not.toContain(
            "- isolates its own pawn on b4",
        );
    });

    it("is empty for an illegal move", () => {
        expect(positionalReasons(START, "e2e5")).toEqual([]);
    });
});

describe("positionalReasons with Stockfish's piece values", () => {
    // White's knight on b1 is its worst piece (2.5); Nc3 makes it 3.6
    const fen = "4k3/8/8/8/8/8/8/RN2K2R w - - 0 30";
    const values = (knight: [string, number]) =>
        new Map<string, number>([knight, ["a1", 5.1], ["h1", 5.3]]);
    const valued = (uci: string, after: [string, number]) =>
        positionalReasons(fen, uci, {
            before: values(["b1", 2.5]),
            after: values(after),
        }).filter((r) => r.kind === "pieceValue");

    it("says a piece is improved, and when it was the worst one", () => {
        expect(valued("b1c3", ["c3", 3.6])).toEqual([
            {
                kind: "pieceValue",
                good: true,
                text: "improves its worst piece, the knight: Stockfish's piece values put it 1.1 higher on c3 than on b1",
            },
        ]);
    });

    it("says a piece goes to a worse square", () => {
        expect(valued("b1a3", ["a3", 1.6])).toEqual([
            {
                kind: "pieceValue",
                good: false,
                text: "puts the knight on a worse square: Stockfish's piece values put it 0.9 lower on a3 than on b1",
            },
        ]);
    });

    it("measures against the other pieces: all rising together is no change", () => {
        // every piece 40% up after the move (whose turn it is), the knight with them
        const reasons = positionalReasons(fen, "b1c3", {
            before: values(["b1", 2.5]),
            after: new Map([
                ["c3", 3.5],
                ["a1", 7.14],
                ["h1", 7.42],
            ]),
        }).filter((r) => r.kind === "pieceValue");
        expect(reasons).toEqual([]);
    });

    it("leaves small changes, and Black's negative values, unsaid", () => {
        expect(valued("b1c3", ["c3", 2.9])).toEqual([]);
        // Black: values are negative; -3.6 after -2.5 is an improvement
        const black = "rn2k2r/8/8/8/8/8/8/4K3 b - - 0 30";
        const reasons = positionalReasons(black, "b8c6", {
            before: new Map([["b8", -2.5]]),
            after: new Map([["c6", -3.6]]),
        }).filter((r) => r.kind === "pieceValue");
        expect(reasons[0]?.good).toBe(true);
    });

    it("says nothing without values (other engines)", () => {
        expect(
            positionalReasons(fen, "b1c3").some((r) => r.kind === "pieceValue"),
        ).toBe(false);
    });
});

describe("the bad bishop", () => {
    const bishop = (fen: string, uci: string) =>
        positionalReasons(fen, uci)
            .filter((r) => r.kind === "badBishop")
            .map((r) => `${r.good ? "+" : "-"} ${r.text}`);

    it("the Advance French: 3.e5 shuts in Black's light-squared bishop", () => {
        // 1.e4 e6 2.d4 d5, White plays e5. White's dark pawns are fixed too, but its bishop
        // on c1 has the open diagonal to h6: not bad. Black's on c8 can go to d7 only.
        const fen =
            "rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq d6 0 3";
        expect(bishop(fen, "e4e5")).toEqual([
            "+ leaves the opponent a bad light-squared bishop: its pawns on d5 and e6 are fixed on the bishop's colour",
        ]);
    });

    it("trades off a bad bishop for the opponent's piece", () => {
        // Black's bishop on c8 is shut in behind d5 and e6; Bxd7 trades it for the knight
        const fen = "2b3k1/1p1N4/4p3/3pP3/3P4/8/8/4K3 b - - 0 1";
        expect(bishop(fen, "c8d7")).toEqual([
            "+ trades off its bad bishop (its pawns on d5 and e6 are fixed on the bishop's colour)",
        ]);
    });

    it("frees a bad bishop when a fixed pawn gets loose", () => {
        // fxe5: the e6 pawn is no longer blocked by a white pawn
        const fen = "2b3k1/8/4pp2/3pP3/3P4/8/8/4K3 b - - 0 1";
        expect(bishop(fen, "f6e5")).toEqual([
            "+ frees its light-squared bishop: its pawns on d5 and e6 no longer all hem it in",
        ]);
    });

    it("does not call a bishop outside its pawns bad", () => {
        // the same pawns, but the bishop already stands on b5, in front of them: active
        const fen = "6k1/8/4p3/1b1pP3/3P4/8/8/4KB2 b - - 0 1";
        expect(bishop(fen, "b5f1")).toEqual([]);
    });

    it("takes Stockfish's word: a bishop worth as much as its partner is not called bad", () => {
        const fen =
            "rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq d6 0 3";
        // Black's values are negative; f8 is the partner of the c8 bishop
        const values = (c8: number) => ({
            before: new Map([
                ["c8", -4.4],
                ["f8", -4.4],
            ]),
            after: new Map([
                ["c8", c8],
                ["f8", -4.46],
            ]),
        });
        const said = (c8: number) =>
            positionalReasons(fen, "e4e5", values(c8)).filter(
                (r) => r.kind === "badBishop",
            ).length;
        // Stockfish's own values after 3.e5: c8 4.44, f8 4.46: worth less, as the rule says
        expect(said(-4.44)).toBe(1);
        expect(said(-4.6)).toBe(0); // worth more than its partner: nothing said
    });

    it("says nothing where no pawns are fixed", () => {
        expect(
            bishop(
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "e2e4",
            ),
        ).toEqual([]);
        // one fixed pawn on its colour is not enough
        expect(
            bishop(
                "rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2",
                "d7d5",
            ),
        ).toEqual([]);
    });
});

describe("holes", () => {
    const hole = (fen: string, uci: string) =>
        positionalReasons(fen, uci)
            .filter((r) => r.kind === "weakSquare")
            .map((r) => `${r.good ? "+" : "-"} ${r.text}`);

    it("the Najdorf's ...e5 leaves d5: no black pawn can cover it any more", () => {
        // 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be2, Black plays e5. d6 holds
        // Black's own pawn: a backward pawn, not a hole
        const fen =
            "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP1BPPP/R1BQK2R b KQkq - 1 6";
        expect(hole(fen, "e7e5")).toEqual([
            "- leaves a hole on d5: no pawn can cover it any more",
        ]);
    });

    it("leaves nothing after quiet developing pawn moves", () => {
        const start =
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        expect(hole(start, "e2e4")).toEqual([]);
        expect(hole(start, "d2d4")).toEqual([]);
    });

    it("names the holes a flank push leaves behind", () => {
        // ...g5 with the e-pawn already on e5: neither f6 nor f5 can be covered any more
        const fen =
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
        expect(hole(fen, "g7g5")).toEqual([
            "- leaves holes on f6 and f5: no pawn can cover them any more",
        ]);
    });

    it("says nothing for a pawn capture, a trade made on purpose", () => {
        // cxb5 in a pawn ending leaves c4 uncoverable, but the point is the capture
        expect(hole("4k3/8/p7/1p6/2P5/8/8/4K3 w - - 0 30", "c4b5")).toEqual([]);
    });
});
