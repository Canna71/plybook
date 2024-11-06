import { invoke } from "@tauri-apps/api/core";


const DBTest = () => {


    const initDB = async () => {
        await invoke("init_db");
    }

    return (
        <div>
            <div>
               <button onClick={initDB}>Init DB</button>
                
            </div>
        </div>
    );
}

export default DBTest;