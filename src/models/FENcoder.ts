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

export class ChessPositionEncoder {
    private static readonly FILE_CHARS = "abcdefgh";
    private static readonly PIECE_CHARS = "PNBRQKpnbrqk";

    static encodeFEN(fen: string): Uint8Array {
        // Split FEN string into its 6 mandatory fields
        const parts = fen.split(" ");
        if (parts.length !== 6) {
            throw new Error("Invalid FEN: must contain 6 fields");
        }

        const [position, activeColor, castling, enPassant, halfmove, fullmove] =
            parts;

        // Create a 36-byte buffer (32 for position + 4 for metadata)
        const buffer = new Uint8Array(36);

        // Encode position (first 32 bytes, 4 bits per square)
        let byteIndex = 0;
        let currentByte = 0;
        let isFirstNibble = true;

        const ranks = position.split("/");
        if (ranks.length !== 8) {
            throw new Error("Invalid FEN: position must have 8 ranks");
        }

        for (const rank of ranks) {
            let fileIndex = 0;
            for (let i = 0; i < rank.length; i++) {
                const char = rank[i];
                let pieceValue: number;

                if (/[1-8]/.test(char)) {
                    // Empty squares
                    const emptyCount = parseInt(char);
                    for (let j = 0; j < emptyCount; j++) {
                        if (isFirstNibble) {
                            currentByte = 0 << 4;
                            isFirstNibble = false;
                        } else {
                            buffer[byteIndex++] = currentByte;
                            currentByte = 0;
                            isFirstNibble = true;
                        }
                        fileIndex++;
                    }
                } else {
                    // Piece squares
                    pieceValue = this.PIECE_CHARS.indexOf(char) + 1;
                    if (pieceValue === 0) {
                        throw new Error(`Invalid piece character: ${char}`);
                    }

                    if (isFirstNibble) {
                        currentByte = pieceValue << 4;
                        isFirstNibble = false;
                    } else {
                        buffer[byteIndex++] = currentByte | pieceValue;
                        currentByte = 0;
                        isFirstNibble = true;
                    }
                    fileIndex++;
                }

                if (fileIndex > 8) {
                    throw new Error(
                        "Invalid FEN: rank has more than 8 squares",
                    );
                }
            }

            if (fileIndex !== 8) {
                throw new Error("Invalid FEN: rank has fewer than 8 squares");
            }
        }

        // Complete last byte if necessary
        if (!isFirstNibble) {
            buffer[byteIndex++] = currentByte;
        }

        // Encode metadata (bytes 32-35)

        // Byte 32: Active color (1 bit) + Castling rights (4 bits)
        let metadataByte = 0;
        if (activeColor === "b") metadataByte |= 0b10000000;
        if (castling.includes("K")) metadataByte |= 0b01000000;
        if (castling.includes("Q")) metadataByte |= 0b00100000;
        if (castling.includes("k")) metadataByte |= 0b00010000;
        if (castling.includes("q")) metadataByte |= 0b00001000;
        buffer[32] = metadataByte;

        // Byte 33: En passant square
        if (enPassant !== "-") {
            const file = this.FILE_CHARS.indexOf(enPassant[0]);
            const rank = parseInt(enPassant[1]) - 1;
            if (file === -1 || rank < 0 || rank > 7) {
                throw new Error("Invalid en passant square");
            }
            buffer[33] = file | (rank << 3);
        } else {
            buffer[33] = 0xff; // No en passant
        }

        // Byte 34: Halfmove clock
        const halfmoveNum = parseInt(halfmove);
        if (isNaN(halfmoveNum) || halfmoveNum < 0 || halfmoveNum > 255) {
            throw new Error("Invalid halfmove clock value");
        }
        buffer[34] = halfmoveNum;

        // Byte 35: Fullmove number
        const fullmoveNum = parseInt(fullmove);
        if (isNaN(fullmoveNum) || fullmoveNum < 1 || fullmoveNum > 255) {
            throw new Error("Invalid fullmove number");
        }
        buffer[35] = fullmoveNum;

        return buffer;
    }

    static decodeFEN(buffer: Uint8Array): string {
        if (buffer.length !== 36) {
            throw new Error("Invalid buffer length");
        }

        // Decode position
        let position = "";
        let emptyCount = 0;

        for (let square = 0; square < 64; square++) {
            if (square > 0 && square % 8 === 0) {
                if (emptyCount > 0) {
                    position += emptyCount;
                    emptyCount = 0;
                }
                position += "/";
            }

            const byteIndex = Math.floor(square / 2);
            const isUpperNibble = square % 2 === 0;
            const value = isUpperNibble
                ? buffer[byteIndex] >> 4
                : buffer[byteIndex] & 0x0f;

            if (value === 0) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    position += emptyCount;
                    emptyCount = 0;
                }
                position += this.PIECE_CHARS[value - 1];
            }
        }

        if (emptyCount > 0) {
            position += emptyCount;
        }

        // Decode metadata
        const metadataByte = buffer[32];
        const activeColor = metadataByte & 0b10000000 ? "b" : "w";

        let castling = "";
        if (metadataByte & 0b01000000) castling += "K";
        if (metadataByte & 0b00100000) castling += "Q";
        if (metadataByte & 0b00010000) castling += "k";
        if (metadataByte & 0b00001000) castling += "q";
        if (castling === "") castling = "-";

        // Decode en passant
        let enPassant = "-";
        if (buffer[33] !== 0xff) {
            const file = this.FILE_CHARS[buffer[33] & 0b111];
            const rank = ((buffer[33] >> 3) & 0b111) + 1;
            enPassant = `${file}${rank}`;
        }

        // Decode move counters
        const halfmove = buffer[34];
        const fullmove = buffer[35];

        return `${position} ${activeColor} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
    }
}

// Test cases
const testCases = [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 2 5",
    "4k3/8/4K3/8/8/8/8/8 w - - 0 1",
    "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 5 7",
];

function test() {
    testCases.forEach((fen) => {
        try {
            const encoded = ChessPositionEncoder.encodeFEN(fen);
            const decoded = ChessPositionEncoder.decodeFEN(encoded);
        } catch (error) {
            console.error("Error:", error);
        }
    });
}


