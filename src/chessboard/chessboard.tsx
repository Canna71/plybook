import { Chessground } from 'chessground';
import { Config } from 'chessground/config';
import {  Accessor, createEffect, createSignal, onMount, Setter } from 'solid-js';
import { Api } from 'chessground/api';


interface ChessboardProps {
	config: Accessor<Config>;
	setApi?: Setter<Api | undefined>;
	onChessboardClick?: (e: MouseEvent) => void;
}

export function Chessboard(props: ChessboardProps) {
	const [api, setApi] = createSignal<Api | undefined>(undefined);
	let wrapper!: HTMLDivElement;
	

	const onChessboardClick = (e: MouseEvent) => {
		props.onChessboardClick?.(e);
	}

	createEffect(() => {
		const ch = api();
		if (ch) {
			ch.set(props.config());
		}
	});
	
	// solid-js onLoad equivalent
	onMount(async () => {
		if (!wrapper) {
			return;
		}
		const api = Chessground(wrapper, props.config());
		setApi(api);
		props.setApi?.(api);
	});


	return (<div class="chess-container">
		<div ref={wrapper} class="chessboard" onclick={onChessboardClick} >

		</div>
	</div>);


}

