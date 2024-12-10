import { IconPlayerSkipBackFilled, IconPlayerSkipForwardFilled, IconPlayerTrackNextFilled, IconPlayerTrackPrevFilled } from '@tabler/icons-solidjs';
import { Accessor, Component, Setter, Show } from "solid-js";
import { GameModel, Path } from "../models/pgn";

export type ButtonBarProps = {
	game: Accessor<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
}

const ButtonBar:Component<ButtonBarProps> = ({game, currentPath, setCurrentPath}) => {
	
    const onNext = () => {
		
		
        const path = currentPath();
        
        const nextNode = (path && game()?.nodeAt(path))?.children[0] ;
		setCurrentPath(nextNode?.data.path);
	}

	const onPrev = () => {


		const path = currentPath();
		if (!path) {
			return;
		}

		setCurrentPath(path.previous());
	}

	const onRewind = () => {
		setCurrentPath(game()!.pathAtMainlinePly(0));
	}

	const onFastForward = () => {
		const g = game();
		if (!g) {
			return;
		}
		const path = g.pathAtMainlinePly(g.mainline.length - 1);
		setCurrentPath(path);
	}

    
    return <div class="pgnviewer-buttonbar">
		<Show when={game() && currentPath()}>
			<button onClick={onRewind}>
				<IconPlayerTrackPrevFilled size="14" />
			</button>
			<button onClick={onPrev}>
				<IconPlayerSkipBackFilled size="14" />
			</button>
			<button onClick={onNext}>
				<IconPlayerSkipForwardFilled size="14" />
			</button>
			<button onClick={onFastForward}>
				<IconPlayerTrackNextFilled size="14" />
			</button>
		</Show>
	</div>;
}

export default ButtonBar;
