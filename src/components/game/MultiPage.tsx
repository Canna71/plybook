import { batch, Component, createMemo, useContext } from "solid-js";
import { GameContext } from "./GameContext";
import {
    IconArrowLeftSquare,
    IconArrowRightSquare,
} from "@tabler/icons-solidjs";
import Button from "../common/Button";
import { pgn } from "chessops";
import { parsePgn } from "chessops/pgn";
import { makeGame } from "../../models/pgn";
import { getDefaultStudyContent } from "../../storage/fs";

const PageNavigator: Component = () => {
    const {
        gameSignal: [_game, setGame],
        gameIndexSignal: [gameIndex, setGameIndex],
        pgn,
        currentPathSignal: [_currentPath, setCurrentPath],
    } = useContext(GameContext)!;

    const numOfPages = createMemo(() => {
        const pgnString = pgn?.();
        if (!pgnString) {
            return 1;
        }
        const games = parsePgn(pgnString);
        return games.length;
    });

    const onNewPage = () => {
        batch(() => {
            setGameIndex(gameIndex() + 1);
            setCurrentPath(undefined);
            setGame(makeGame(getDefaultStudyContent()));
        });
    };

    return (
        <div>
            <Button onClick={onNewPage}>Add Page</Button>
            <Button onClick={() => setGameIndex(gameIndex() - 1)}>
                <IconArrowLeftSquare />
            </Button>
            <Button onClick={() => setGameIndex(gameIndex() + 1)}>
                <IconArrowRightSquare />
            </Button>
            {gameIndex() + 1}/{numOfPages()}
        </div>
    );
};

export default PageNavigator;
