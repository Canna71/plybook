import { Chessboard } from "../common/chessboard";
import { Accessor, Component, createEffect, createSignal, Match, Switch } from "solid-js";
import { makeGame, Path } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import Moves from "./Moves";
import ButtonBar from "./Buttonbar";
import { getPosition, makeConfig } from "../common/utils";
import { Key, Piece } from "chessground/types";
import { parseSquare, Position } from "chessops";
import { chessgroundDests } from "chessops/compat";
import "./PgnViewer.scss";
import Button from "../common/Button";
import BoardEditor from "../boardeditor/BoardEditor";
import { makeFen, parseFen } from "chessops/fen";

export type PgnEditorOptions = {
	pgn: Accessor<string | undefined>;
	setPgn: (pgn: string) => void;
}

enum ViewMode {
	STARTING_POSITION,
	MOVES
}

const PgnEditor: Component<PgnEditorOptions> = ({ pgn, setPgn }) => {
	const [currentPath, setCurrentPath] = createSignal<Path | undefined>(undefined);
	const [game, setGame] = createSignal<GameModel | undefined>(undefined);
	const [squareHovered, setSquareHovered] = createSignal<string | undefined>(undefined);
	const [viewMode, setViewMode] = createSignal<ViewMode>(ViewMode.MOVES);
	const [startingPosition, setStartingPosition] = createSignal<string | undefined>(undefined);
	// const currentData = useCurrentData(game, currentPath)



	createEffect(() => {
		// const cg = api();
		let pgnString = pgn();
		if (!pgnString) {
			pgnString = "[]";
		}
		const gameModel = makeGame(pgnString);
		setGame(gameModel);
		if (gameModel.headers.get("FEN")) {
			const setup = parseFen(gameModel.headers.get("FEN") || "");
			if (setup.isOk) {
				setStartingPosition(makeFen(setup.value));
			}
		}
		setCurrentPath(gameModel.pathAtMainlinePly(0));

	});

	const onMove = (orig: Key, dest: Key, _capturedPiece?: Piece) => {
		const g = game();
		if (!g) {
			return;
		};
		const path = currentPath() || Path.root;


		// const pos = getPosition(game, currentPath);
		const sq1 = parseSquare(orig);
		const sq2 = parseSquare(dest);
		const move = {
			from: sq1!,
			to: sq2!,
			promotion: undefined
		};

		const [newGameModel, newPath] = g.applyMove(path, move);

		setGame(newGameModel);

		setCurrentPath(newPath);

	}

	const onSelect = (_key: Key) => {
	}

	const onDrawChange = (shapes: any) => {
		const ng = game()?.updateShapes(currentPath()!, shapes);
		setGame(ng);
	}

	const config = () => {

		const baseConfig = makeConfig(game, currentPath, squareHovered)();


		const pos = getPosition(game, currentPath);
		const allDests = chessgroundDests(pos);
		return {
			...baseConfig,
			draggable: {
				enabled: true,
			},
			viewOnly: false,
			turnColor: pos.turn,
			movable: {
				free: false,
				color: pos.turn,
				dests: allDests
			},
			events: {
				move: onMove,

				select: onSelect
			},
			drawable: {
				...baseConfig.drawable,
				eraseOnClick: false,
				onChange: onDrawChange
			}
		}
	}

	// #region Starting Position Editing

	const onEditStartingPosition = () => {
		setViewMode(ViewMode.STARTING_POSITION);
	}

	const onAcceptStartingPosition = () => {
		game()?.headers.set("FEN",startingPosition() || "");
		game()?.headers.set("Setup","1");
		setPgn(game()?.pgn() || "");
		setViewMode(ViewMode.MOVES);
	}

	const onCancelStartingPosition = () => {
		setViewMode(ViewMode.MOVES);
	}

	// #endregion

	return (
		<>
			<div class="pgnviewer-container">
				<div class="pgnviewer-content">
					<Switch>
						<Match when={viewMode() === ViewMode.MOVES}>
							<div class="pgnviewer-chessboard">
								<Chessboard config={config} />
							</div>
						</Match>
						<Match when={viewMode() === ViewMode.STARTING_POSITION}>
							<BoardEditor fen={startingPosition} setFen={setStartingPosition} />
						</Match>
					</Switch>

				</div>

				<div class="pgnviewer-sidebar">
					<div class="pgnviewer-sidebar-header">
						<Switch>
							<Match when={viewMode() === ViewMode.MOVES}>
								<Button onClick={onEditStartingPosition}>Set Starting Position</Button>
							</Match>
							<Match when={viewMode() === ViewMode.STARTING_POSITION}>
								<div class="is-flex is-flex-direction-row is-gap-1">
									<Button onClick={onAcceptStartingPosition}>Accept</Button>
									<Button onClick={onCancelStartingPosition}>Cancel</Button>
								</div>
							</Match>
						</Switch>
					</div>
					<div class="pgnviewer-moves-wrapper">
						<Moves
							setGame={setGame}
							game={game}
							currentPath={currentPath}
							setCurrentPath={setCurrentPath}
							squareHovered={setSquareHovered}
							editable={() => true}
						/>
					</div>
					<ButtonBar
						game={game}
						currentPath={currentPath}
						setCurrentPath={setCurrentPath}
					/>
				</div>
			</div>
			<div class="pgn-viewer-bottom">

			</div>
		</>
	);
}

export default PgnEditor;






