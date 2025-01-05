import { batch, Component, createMemo, Show, useContext } from "solid-js";
import { GameContext } from "./GameContext";
import {
    IconCaretLeftFilled,
    IconCaretRightFilled,
    IconPlus,
} from "@tabler/icons-solidjs";
import Button from "../common/Button";
import { parsePgn } from "chessops/pgn";
import { makeGame } from "../../models/pgn";
import { getDefaultStudyContent } from "../../storage/fs";

const PageNavigator: Component = () => {
    const {
        gameSignal: [_game, setGame],
        gameIndexSignal: [gameIndex, setGameIndex],
        fullPgnSignal: [fullPgn],
        currentPathSignal: [_currentPath, setCurrentPath],
    } = useContext(GameContext)!;

    const numOfPages = createMemo(() => {
        const pgnString = fullPgn?.();
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

    const onChangePage = (index: number) => {
        if (index < 0 || index >= numOfPages()) {
            return;
        }
        batch(() => {
            setGameIndex(index);
            setCurrentPath(undefined);
        });
    }

    return (
        <div class="buttons-bar">
            <Show when={gameIndex() > 0}>
                <Button onClick={() => onChangePage(gameIndex() - 1)}>
                    <IconCaretLeftFilled />
                </Button>
            </Show>
            {gameIndex() + 1}/{numOfPages()}
            <Show when={numOfPages() > gameIndex() + 1}>
                <Button onClick={() => onChangePage(gameIndex() + 1)}>
                    <IconCaretRightFilled />
                </Button>
            </Show>
            <Show when={numOfPages() === gameIndex() + 1}>
                <Button onClick={onNewPage}>
                    <IconPlus />
                </Button>
            </Show>
        </div>
    );
};

export default PageNavigator;
