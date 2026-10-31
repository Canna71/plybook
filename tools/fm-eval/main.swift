// F.2 evaluation: can Apple's on-device model reword Plybook's explanations without changing
// the chess? Same system prompt as src-tauri/src/model.rs, greedy decoding. Needs macOS 26+,
// Apple silicon and Apple Intelligence on. Run: swift tools/fm-eval/main.swift
// Results of 2026-10-31 (macOS 27.0.1) are in docs/ROADMAP.md, F.2.
import Foundation
import FoundationModels

let system = """
You reword chess move explanations for a club player. You are given an explanation computed by \
a chess engine and chess rules. Rewrite it as a short paragraph a coach would say: natural, plain \
words, no more than four sentences. Use only what the text says: do not add moves, variations, \
evaluations, pieces or squares that are not in it, and keep every move and square exactly as \
written (for example Nf3, exd5, the knight on d5). No markdown, no lists, no headings. Reply \
with the paragraph only.
"""

let samples = [
    "Ke2 is the engine's choice. It brings the king towards the centre: in an endgame the king is a fighting piece. Then Kd8 Kd2 Ke8 Kc3 Ke7 Kb4: material stays level.",
    "Qxf7+ was a blunder (-4.2). It lets Black play Kxf7: the queen is lost for a pawn. Better was Nf3, which develops the knight and keeps the attack on e5. Then Nc6 Bc4: White is slightly better (+0.4).",
    "Nd5 forks the queen on c7 and the rook on e7. Black cannot save both: after Qd8 Nxe7+ Qxe7, White has won the exchange (+2.1). It was the only good move: anything else is about equal.",
    "h3 stops Bg4, which would pin the knight on f3 to the queen on d1. It is prophylaxis: it takes a square away before Black can use it. The evaluation stays about equal (+0.2).",
]

let model = SystemLanguageModel.default
print("availability:", model.availability)
guard case .available = model.availability else { exit(1) }

for text in samples {
    let session = LanguageModelSession(instructions: system)
    let start = Date()
    do {
        let answer = try await session.respond(
            to: text, options: GenerationOptions(sampling: .greedy))
        print("\n--- IN:  \(text)")
        print("--- OUT: \(answer.content)")
        print(String(format: "--- %.1f s", Date().timeIntervalSince(start)))
    } catch {
        print("\n--- IN: \(text)\n--- ERROR: \(error)")
    }
}
