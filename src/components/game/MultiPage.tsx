import { batch, Component, createMemo, Show, useContext } from "solid-js";
import { GameContext } from "./GameContext";
import {
    IconCaretLeftFilled,
    IconCaretRightFilled,
    IconPlus,
    IconX,
} from "@tabler/icons-solidjs";
import Button from "../common/Button";
import { makePgn, parsePgn } from "chessops/pgn";
import { makeGame } from "../../models/pgn";
import { getDefaultStudyContent } from "../../storage/fs";

const PageNavigator: Component = () => {
    const {
        gameSignal: [_game, setGame],
        gameIndexSignal: [gameIndex, setGameIndex],
        fullPgnSignal: [fullPgn, setFullPgn],
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

    const onDeletePage = () => {
        if (numOfPages() === 1) {
            return;
        }
        let games = parsePgn(fullPgn()!);
        games = games.filter((_, i) => i !== gameIndex());
        let newIndex = Math.max(gameIndex()-1, 0);
        let newPgn = games.map((g) => makePgn(g)).join("\n\n");
        batch(() => {
            setFullPgn(newPgn);
            setGameIndex(newIndex);
            setCurrentPath(undefined);
            // setGame(makeGame(newPgn));
        });
    }


    return (
        <div class="buttons-bar page-navigation">
            <Show when={gameIndex() > 0}>
                <Button onClick={() => onChangePage(gameIndex() - 1)}>
                    <IconCaretLeftFilled />
                </Button>
            </Show>
            <div class="current-page">
                {gameIndex() + 1} / {numOfPages()}
            </div>      
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
            {/* <Show when={numOfPages() > 1}>
                <div class="pages">
                    {Array.from({ length: numOfPages() }).map((_, i) => (
                        <Button
                            class={gameIndex() === i ? "is-active" : ""}
                            onClick={() => onChangePage(i)}
                        >
                            {i + 1}
                        </Button>
                    ))}
                </div>
            </Show> */}
            <Show when={numOfPages() > 1}>
                <Button onClick={onDeletePage} title="Delete Page">
                    <IconX />
                </Button>
            </Show>
        </div>
    );
};

export default PageNavigator;
