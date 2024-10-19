import { Chessground } from 'chessground';
import { Config } from 'chessground/config';
import {  onMount, Setter } from 'solid-js';
import { Api } from 'chessground/api';


interface ChessboardProps {
	config?: Config;
	setApi?: Setter<Api | undefined>;
	onChessboardClick?: (e: MouseEvent) => void;
}

export function Chessboard(props: ChessboardProps) {
	// create a div under el and set its width and height to 100%

	let wrapper!: HTMLDivElement;
	

	const onChessboardClick = (e: MouseEvent) => {
		props.onChessboardClick?.(e);
	}

	
	// solid-js onLoad equivalent
	onMount(async () => {
		if (!wrapper) {
			return;
		}
		const api = Chessground(wrapper, props.config);
		
		props.setApi?.(api);
	});


	return (<div class="chess-container">
		<div ref={wrapper} class="chessboard" onclick={onChessboardClick} >

		</div>
	</div>);


}

