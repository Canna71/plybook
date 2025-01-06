// 【FEN compression standards - Monica AI Chat】https://monica.im/share/chat?shareId=DVPOMQsURTrWgHMP
// Piece encoding (4 bits):
// First bit: color (0 = white, 1 = black)
// Next 3 bits: piece type
// 000 - empty (only valid with color bit 0)
// 001 - pawn
// 010 - knight
// 011 - bishop
// 100 - rook
// 101 - queen
// 110 - king

const PIECE_TO_CODE: { [key: string]: number } = {
    P: 1, // white pawn
    N: 2, // white knight
    B: 3, // white bishop
    R: 4, // white rook
    Q: 5, // white queen
    K: 6, // white king
    p: 9, // black pawn (8 + 1)
    n: 10, // black knight (8 + 2)
    b: 11, // black bishop (8 + 3)
    r: 12, // black rook (8 + 4)
    q: 13, // black queen (8 + 5)
    k: 14, // black king (8 + 6)
};

const CODE_TO_PIECE: { [key: number]: string } = {
    0: " ", // empty
    1: "P", // white pawn
    2: "N", // white knight
    3: "B", // white bishop
    4: "R", // white rook
    5: "Q", // white queen
    6: "K", // white king
    9: "p", // black pawn
    10: "n", // black knight
    11: "b", // black bishop
    12: "r", // black rook
    13: "q", // black queen
    14: "k", // black king
};

export class ChessPositionEncoder {
    // We'll use additional bits to store castling rights and other FEN components
    static encodeFEN(fen: string): Uint8Array {
        const [position, activeColor, castling, enPassant, halfmove, fullmove] =
            fen.split(" ");

        // We'll use 33 bytes:
        // - 32 bytes for position (256 bits)
        // - 1 byte for additional data:
        //   - bit 7: active color (0 for white, 1 for black)
        //   - bits 6-3: castling rights (KQkq)
        //   - bits 2-0: reserved for future use
        const buffer = new Uint8Array(33);

        // Encode position (same as before)
        let currentByte = 0;
        let currentBit = 0;

        // Encode board position
        const ranks = position.split("/");
        for (const rank of ranks) {
            for (let i = 0; i < rank.length; i++) {
                const char = rank[i];
                if (/\d/.test(char)) {
                    const emptyCount = parseInt(char);
                    for (let j = 0; j < emptyCount; j++) {
                        currentBit += 4;
                        if (currentBit === 8) {
                            currentBit = 0;
                            currentByte++;
                        }
                    }
                } else {
                    const pieceCode = PIECE_TO_CODE[char];
                    if (currentBit === 0) {
                        buffer[currentByte] = pieceCode << 4;
                        currentBit = 4;
                    } else {
                        buffer[currentByte] |= pieceCode;
                        currentByte++;
                        currentBit = 0;
                    }
                }
            }
        }

        // Encode additional data in byte 32
        let metadataByte = 0;

        // Active color (bit 7)
        if (activeColor === "b") {
            metadataByte |= 0b10000000;
        }

        // Castling rights (bits 6-3)
        if (castling.includes("K")) metadataByte |= 0b01000000;
        if (castling.includes("Q")) metadataByte |= 0b00100000;
        if (castling.includes("k")) metadataByte |= 0b00010000;
        if (castling.includes("q")) metadataByte |= 0b00001000;

        buffer[32] = metadataByte;

        return buffer;
    }

    static decodeFEN(buffer: Uint8Array): string {
        let fen = "";
        let currentByte = 0;
        let currentBit = 0;
        let emptyCount = 0;

        // Decode position
        for (let rank = 0; rank < 8; rank++) {
            if (rank > 0) fen += "/";
            emptyCount = 0;

            for (let file = 0; file < 8; file++) {
                let pieceCode;
                if (currentBit === 0) {
                    pieceCode = buffer[currentByte] >> 4;
                } else {
                    pieceCode = buffer[currentByte] & 0x0f;
                    currentByte++;
                }
                currentBit = (currentBit + 4) % 8;

                if (pieceCode === 0) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fen += emptyCount.toString();
                        emptyCount = 0;
                    }
                    fen += CODE_TO_PIECE[pieceCode];
                }
            }

            if (emptyCount > 0) {
                fen += emptyCount.toString();
            }
        }

        // Decode metadata from byte 32
        const metadataByte = buffer[32];

        // Active color
        const activeColor = metadataByte & 0b10000000 ? "b" : "w";

        // Castling rights
        let castling = "";
        if (metadataByte & 0b01000000) castling += "K";
        if (metadataByte & 0b00100000) castling += "Q";
        if (metadataByte & 0b00010000) castling += "k";
        if (metadataByte & 0b00001000) castling += "q";
        if (castling === "") castling = "-";

        // Add remaining components
        // Note: For simplicity, we're using default values for en passant, halfmove, and fullmove
        return `${fen} ${activeColor} ${castling} - 0 1`;
    }
}

// Test function
function testFENEncoding(fen: string) {
    console.log("Original:", fen);
    const encoded = ChessPositionEncoder.encodeFEN(fen);
    const decoded = ChessPositionEncoder.decodeFEN(encoded);
    console.log("Decoded: ", decoded);
    console.log("Match:   ", fen === decoded);
    return fen === decoded;
}

// Test cases
const testPositions = [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
    "8/8/8/8/8/8/8/8 w - - 0 1",
];

// Encodes a FEN string to a compressed binary format
export function encodeFEN(fen: string): Uint8Array {
    const [position] = fen.split(" "); // We'll only encode the position part
    const ranks = position.split("/");
    const buffer = new Uint8Array(32); // 256 bits = 32 bytes
    let currentByte = 0;
    let currentBit = 0;

    for (const rank of ranks) {
        for (let i = 0; i < rank.length; i++) {
            const char = rank[i];
            if (/\d/.test(char)) {
                // Handle empty squares
                const emptyCount = parseInt(char);
                for (let j = 0; j < emptyCount; j++) {
                    // Write 4 bits of 0 for each empty square
                    currentBit += 4;
                    if (currentBit === 8) {
                        currentBit = 0;
                        currentByte++;
                    }
                }
            } else {
                const pieceCode = PIECE_TO_CODE[char];
                if (currentBit === 0) {
                    buffer[currentByte] = pieceCode << 4;
                    currentBit = 4;
                } else {
                    buffer[currentByte] |= pieceCode;
                    currentByte++;
                    currentBit = 0;
                }
            }
        }
    }

    return buffer;
}

// Decodes a compressed binary format back to FEN string
export function decodeFEN(buffer: Uint8Array): string {
    let fen = "";
    let currentByte = 0;
    let currentBit = 0;
    let emptyCount = 0;

    for (let rank = 0; rank < 8; rank++) {
        if (rank > 0) fen += "/";
        emptyCount = 0;

        for (let file = 0; file < 8; file++) {
            let pieceCode;
            if (currentBit === 0) {
                pieceCode = buffer[currentByte] >> 4;
            } else {
                pieceCode = buffer[currentByte] & 0x0f;
                currentByte++;
            }
            currentBit = (currentBit + 4) % 8;

            if (pieceCode === 0) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    fen += emptyCount.toString();
                    emptyCount = 0;
                }
                fen += CODE_TO_PIECE[pieceCode];
            }
        }

        if (emptyCount > 0) {
            fen += emptyCount.toString();
        }
    }

    // Add the remaining FEN components for a complete FEN string
    const [, ...remainingParts] =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".split(" ");
    return fen + " " + remainingParts.join(" ");
}

// turns a UInt8Array into a string of characters in order to be stored in a database

export function encodeUint8Array(array: Uint8Array): string {
    return String.fromCharCode(...array);
}

// turns a string of characters into a UInt8Array in order to be used in the decodeFEN function

export function decodeString(string: string): Uint8Array {
    const array = new Uint8Array(string.length);
    for (let i = 0; i < string.length; i++) {
        array[i] = string.charCodeAt(i);
    }
    return array;
}
