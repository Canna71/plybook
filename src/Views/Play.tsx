import { createEffect } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import GameManager from "../components/game/GameManager";
import { useSearchParams } from "@solidjs/router";

const PlayView = () => {

   
    const [searchParams, _setSearchParams] = useSearchParams();
    
    createEffect(async () => {
        if(typeof(searchParams.fen) === "string") {
            
        } else {
            
        }
    });

   

    return (
        <>
            <div class="playarea-header">
                TODO: ELO | DEPTH | Color | Time Control | Engine Name | Resign | Draw | New Game | Flip Board | Save Game | Load Game
            </div>
            <GameManager 
                engineColor={()=>'white'}
            />
        </>
    );
}

export default PlayView;
