import { Chessboard } from "../common/chessboard";
import { Accessor, Component, createEffect, createSignal, Match, Show, Switch, useContext } from "solid-js";
import { makeGame, Path } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import Moves from "./Moves";
import ButtonBar from "./Buttonbar";
import { getPosition, makeConfig, useSplitter } from "../common/utils";
import { Key, Piece } from "chessground/types";
import { Color, parseSquare } from "chessops";
import { chessgroundDests } from "chessops/compat";
import "./PgnViewer.scss";
import Button from "../common/Button";
import BoardEditor from "../boardeditor/BoardEditor";
import { makeFen, parseFen } from "chessops/fen";
import { IconUser, IconUserFilled } from "@tabler/icons-solidjs";
import { GameContext } from "./GameContext";
import { VDivider } from "../common/VDivider";
import PlayerName from "../boardeditor/PlayerName";

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
	// let divider: HTMLDivElement | null = null;
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
		const isCheck = pos.isCheck();
		const allDests = chessgroundDests(pos);
		const config = {
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
			check: isCheck,
			events: {
				move: onMove,

				select: onSelect
			},
			drawable: {
				...baseConfig.drawable,
				eraseOnClick: false,
				onChange: onDrawChange
			}
		};
		return config;
	}

	const whitePlayer = () => game()?.players.white.name || "White";
	const setWhitePlayer = (name: string) => {
		game()!.players.white.name = name;
		setGame(game()?.clone());
	}

	const blackPlayer = () => game()?.players.black.name || "Black";
	const setBlackPlayer = (name: string) => {
		game()!.players.black.name = name;
		setGame(game()?.clone());
	}

	// #region Starting Position Editing

	const onEditStartingPosition = () => {
		setViewMode(ViewMode.STARTING_POSITION);
	}

	const onAcceptStartingPosition = () => {
		game()?.headers.set("FEN", startingPosition() || "");
		game()?.headers.set("Setup", "1");
		setPgn(game()?.pgn() || "");
		setViewMode(ViewMode.MOVES);
	}

	const onCancelStartingPosition = () => {
		setViewMode(ViewMode.MOVES);
	}

	createEffect(() => {
		const newPgn = game()?.pgn();
		if (newPgn) {
			setPgn(newPgn);
		}
	});

	// #endregion

	const divider = useSplitter();
	// #endregion

	return (
		<>
			<GameContext.Provider value={
				{
					game: game,
					setGame: setGame,
					currentPath: currentPath,
					setCurrentPath: setCurrentPath,
					setSquareHovered: setSquareHovered,
					editable: ()=>true,
				}
			}>
				<div class="pgnviewer-container">
					<div class="pgnviewer-content">
						<Switch>
							<Match when={viewMode() === ViewMode.MOVES}>
								<PlayerName name={blackPlayer} setName={setBlackPlayer} color="black" />
								<div class="pgnviewer-chessboard">
									<Chessboard config={config} />
								</div>
								<PlayerName name={whitePlayer} setName={setWhitePlayer} color="white" />
							</Match>
							<Match when={viewMode() === ViewMode.STARTING_POSITION}>
								<BoardEditor fen={startingPosition} setFen={setStartingPosition} />
							</Match>
						</Switch>

					</div>
					<VDivider ref={divider!} />
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
							<Moves />
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
			</GameContext.Provider>
		</>
	);
}

export default PgnEditor;







