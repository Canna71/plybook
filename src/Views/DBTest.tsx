import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, readTextFile } from "@tauri-apps/plugin-fs";
import { makeGame } from "../models/pgn";

type IGame = {
    file: string,
    timeControlInitial: number,
    timeControlIncrement: number,
    orientation: string,
    result: string,
    whiteName: string,
    whiteRating: number,
    whiteTitle: string,
    blackName: string,
    blackRating: number,
    blackTitle: string
}

const DBTest = () => {


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
            orientation: gameModel.metadata.orientation || "",
            result: gameModel.metadata.result || "",
            whiteName: gameModel.players.white.name || "",
            whiteTitle: gameModel.players.white.title || "",
            whiteRating: gameModel.players.white.rating || -1,
            blackName: gameModel.players.black.name || "",
            blackTitle: gameModel.players.black.title || "",
            blackRating: gameModel.players.black.rating || -1,
        };
        await invoke("create_record", {
            table: "games",
            data:game
        });
    }

    return (
        <div>
            <div>
               <button onClick={initDB}>Init DB</button>
               <button onClick={createRecord}>Create Record</button>
                
            </div>
        </div>
    );
}

export default DBTest;