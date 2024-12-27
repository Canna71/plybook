import { Color, Role } from 'chessground/types';
import { Component, createSignal, onMount } from 'solid-js';
import { createDraggable } from '@neodrag/solid';
import { Piece } from '../common/Piece';

// const roles is all values of Role type, using typescript


export type DraggablePieceProps = {
	role: Role;
	color: Color;
	onDrop?: (role: Role, color: Color, domPosition: DOMRect) => void;
};

export const DraggablePiece: Component<DraggablePieceProps> = (props) => {
	// @ts-ignore
	const { draggable } = createDraggable();
	const [position, setPosition] = createSignal({ x: 0, y: 0 });
	let ref: HTMLDivElement | null = null;

	onMount(() => {
		if (ref) {
			draggable(ref, () => ({
				bounds: '.board-editor-container',
				onDragEnd: (data) => {
					// Implement your drop logic here
					const el = data.rootNode;
					// get el absolute position
					const rect = el.getBoundingClientRect();
					setPosition({ x: 0, y: 0 });
					props.onDrop?.(props.role, props.color, rect);
				},
				defaultPosition: { x: 0, y: 0 },
				position: position(),

			}));
		}
	});

	return <Piece role={props.role} color={props.color}
		ref={(el)=>{ref = el;}}
	></Piece>
}




