import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, readTextFile } from "@tauri-apps/plugin-fs";
import { makeGame } from "../models/pgn";

type IGame = {
    file: string,
    timeControlInitial: number,
    timeControlIncrement: number,
    // orientation: string,
    result: string,
    whiteName: string,
    whiteRating: number,
    // whiteTitle: string,
    blackName: string,
    blackRating: number,
    // blackTitle: string,
    eventDate: string,
    round: number
}

const DBTest = () => {

    let pgnTextArea!: HTMLTextAreaElement;

    const initDB = async () => {
        await invoke("init_db");
    }

    const createRecord = async () => {
        const pgnString = await readTextFile('testdata/01.pgn',
            {
                baseDir: BaseDirectory.Resource
            });
        const gameModel = makeGame(pgnString);
        const game: IGame = {
            file: "01.pgn",
            timeControlInitial: gameModel.metadata.timeControl?.initial || -1,
            timeControlIncrement: gameModel.metadata.timeControl?.increment || -1,
            // orientation: gameModel.metadata.orientation || "",
            result: gameModel.metadata.result || "",
            whiteName: gameModel.players.white.name || "",
            // whiteTitle: gameModel.players.white.title || "",
            whiteRating: gameModel.players.white.rating || -1,
            blackName: gameModel.players.black.name || "",
            // blackTitle: gameModel.players.black.title || "",
            blackRating: gameModel.players.black.rating || -1,
            eventDate: "",
            round:  -1
        };
        await invoke("index_game", {
            game
        });
    }

    const listGames = async () => {
        const games = await invoke("list_games");
        console.log(games);
    }

    const uploadPgn = async (_e: MouseEvent) => {
        const pgnText = (pgnTextArea?.value);
        await invoke("upload_pgn", {
            pgn: pgnText
        });
    }

    return (
        <div class="dbtest-container">
            <div>
                <button onClick={initDB}>Init DB</button>
                <button onClick={createRecord}>Index Game</button>
                <button onClick={listGames}>List Games</button>
                <button onClick={uploadPgn}>Upload PGN</button>
            </div>
            <div>

                <textarea ref={pgnTextArea} name="pgn" id="pgnText">
                    {`
[Event "Sample Analysis Game"]
[Site "Online Analysis"]
[Date "2024.11.09"]
[Round "1"]
[White "User"]
[Black "Chess Mentor"]
[Result "*"]
[WhiteElo "1200"]
[BlackElo "1800"]
[TimeControl "300+5"]
[Annotator "Chess Mentor"]
[Opening "King's Pawn Opening"]
[ECO "C20"]
[Variation "King's Pawn Game"]
[FEN "r1b2rk1/1pp2pp1/p1nb1q1p/3pp3/7P/N2P1N2/PPP1PPP1/1R1QKB1R b K - 0 1"]
[PlyCount "8"]


1... e4 {
Black aggressively pushes in the center to increase pressure,
forcing White to respond and potentially opening lines for Black's pieces.
} (
1... Be6 {
A consolidating move that defends the d5-pawn but lacks immediate threat. 
}
) (
1... Bg4 {
Pins the knight on f3, but White can easily break the pin,
making it less effective than the dynamic central push e5-e4.
}
) 2. dxe4 dxe4 (
2... f5 {
Keeping central tension with a more closed position, though less direct.
}
) 3. a3 {
White develops and prepares for c4 to challenge Black's center. 
} (
3. Nxe4 {
White could capture on e4 immediately, leading to further exchanges.
}
) 3... f3 (
3... Qg6 {
An alternative, preparing to bring the queen to an active square. 
}
) 4. gxf3 {
White captures back, keeping central control.
} (
4. Qxf3 {
Alternatively capturing with the queen, maintaining flexibility in the center. 
}
)
    `}
                    


                </textarea>
            </div>
        </div>
    );
}

export default DBTest;