import { createEffect, createSignal } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import GameManager from "../components/game/GameManager";
import { readDataFile, writeDataFile } from "../storage/fs";
import { useSearchParams } from "@solidjs/router";
import Button from "../components/common/Button";

const PlayView = () => {

   
    const [searchParams, _setSearchParams] = useSearchParams();
    
    createEffect(async () => {
        if(typeof(searchParams.fen) === "string") {
            
        } else {
            
        }
    });

   

    return (
        <>
            <GameManager 
                engineColor={()=>'black'}
            />
        </>
    );
}

export default PlayView;
