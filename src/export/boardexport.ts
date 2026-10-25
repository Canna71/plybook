// Board images and animated GIFs (O.5), drawn with the board and piece theme in use: the
// theme's images are read from a hidden board, so exports look like the app.

import { Color } from "chessops";
import { parseFen } from "chessops/fen";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { BoardFrame, squareOrigin } from "../models/boardframes";

const ROLES = ["pawn", "knight", "bishop", "rook", "queen", "king"];
const COLORS = ["white", "black"];
/** Lichess's last-move highlight */
const LAST_MOVE = "rgba(155, 199, 0, 0.41)";
/** Board squares when a theme has no image */
const LIGHT = "#f0d9b5";
const DARK = "#b58863";

type ThemeImages = {
    board?: HTMLImageElement;
    pieces: Map<string, HTMLImageElement>;
};

const urlOf = (el: Element) =>
    /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(el).backgroundImage)?.[1];

async function load(src: string): Promise<HTMLImageElement | undefined> {
    const img = new Image();
    img.src = src;
    try {
        await img.decode();
        return img;
    } catch {
        return undefined;
    }
}

/** The theme's board and pieces, read from a board laid out off screen. */
async function themeImages(): Promise<ThemeImages> {
    const wrap = document.createElement("div");
    wrap.className = "cg-wrap";
    wrap.style.cssText =
        "position:absolute;left:-10000px;top:0;width:64px;height:64px";
    const board = document.createElement("cg-board");
    wrap.append(board);
    const pieces: [string, Element][] = [];
    for (const color of COLORS) {
        for (const role of ROLES) {
            const piece = document.createElement("piece");
            piece.className = `${role} ${color}`;
            board.append(piece);
            pieces.push([`${color} ${role}`, piece]);
        }
    }
    document.body.append(wrap);
    const boardUrl = urlOf(board);
    const pieceUrls = pieces.map(([key, el]) => [key, urlOf(el)] as const);
    wrap.remove();

    const images: ThemeImages = {
        board: boardUrl ? await load(boardUrl) : undefined,
        pieces: new Map(),
    };
    for (const [key, url] of pieceUrls) {
        const img = url && (await load(url));
        if (img) images.pieces.set(key, img);
    }
    return images;
}

function draw(
    ctx: CanvasRenderingContext2D,
    frame: BoardFrame,
    orientation: Color,
    size: number,
    theme: ThemeImages,
) {
    const s = size / 8;
    if (theme.board) {
        ctx.drawImage(theme.board, 0, 0, size, size);
    } else {
        for (let sq = 0; sq < 64; sq++) {
            const { x, y } = squareOrigin(sq, orientation, size);
            ctx.fillStyle = ((sq % 8) + Math.floor(sq / 8)) & 1 ? LIGHT : DARK;
            ctx.fillRect(x, y, s, s);
        }
    }
    if (frame.lastMove) {
        ctx.fillStyle = LAST_MOVE;
        for (const sq of [frame.lastMove.from, frame.lastMove.to]) {
            const { x, y } = squareOrigin(sq, orientation, size);
            ctx.fillRect(x, y, s, s);
        }
    }
    const setup = parseFen(frame.fen);
    if (!setup.isOk) return;
    for (const [sq, piece] of setup.value.board) {
        const img = theme.pieces.get(`${piece.color} ${piece.role}`);
        if (!img) continue;
        const { x, y } = squareOrigin(sq, orientation, size);
        ctx.drawImage(img, x, y, s, s);
    }
}

function canvasOf(size: number) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return {
        canvas,
        ctx: canvas.getContext("2d", { willReadFrequently: true })!,
    };
}

/** A PNG of one position. */
export async function boardPng(
    frame: BoardFrame,
    orientation: Color,
    size = 800,
): Promise<Blob> {
    const theme = await themeImages();
    const { canvas, ctx } = canvasOf(size);
    draw(ctx, frame, orientation, size, theme);
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("No image"))),
            "image/png",
        ),
    );
}

/** An animated GIF of positions, one a second, the last held longer. */
export async function boardGif(
    frames: BoardFrame[],
    orientation: Color,
    size = 400,
    delay = 1000,
): Promise<Uint8Array> {
    const theme = await themeImages();
    const { ctx } = canvasOf(size);
    const gif = GIFEncoder();
    for (const [i, frame] of frames.entries()) {
        draw(ctx, frame, orientation, size, theme);
        const { data } = ctx.getImageData(0, 0, size, size);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), size, size, {
            palette,
            delay: i === frames.length - 1 ? delay * 3 : delay,
            repeat: i === 0 ? 0 : undefined,
        });
        // keep the window responsive on long games
        if (i % 10 === 9) await new Promise((r) => setTimeout(r));
    }
    gif.finish();
    return gif.bytes();
}

/** Puts a PNG on the clipboard. */
export async function copyPng(png: Blob) {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
