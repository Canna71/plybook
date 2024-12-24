import { Color, Role } from 'chessground/types';
import { Accessor, Component, createSignal, Setter } from 'solid-js';
import type * as cg from 'chessground/types';
import { createDraggable } from '@neodrag/solid';

// const roles is all values of Role type, using typescript

export const ROLES: Role[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

// export a Piece solid-js component that takes a role and color prop and renders a piece
// with the appropriate class name

export type PieceProps = {
	role: Role;
	color: Color;
	onDrop?: (role: Role, color: Color, domPosition: DOMRect) => void;
};

export const Piece:Component<PieceProps> = (props) => {
	const { draggable } = createDraggable();
	const [position, setPosition] = createSignal({ x: 0, y: 0 });
	
	return <piece 
		use:draggable={{
			bounds: '.board-editor-container',
			onDragEnd: (data) => {
				// Implement your drop logic here
				const el = data.rootNode;
				// get el absolute position
				const rect = el.getBoundingClientRect();
				setPosition({ x: 0, y: 0 });
				props.onDrop?.(props.role, props.color, rect);
			},
			defaultPosition: {x: 0, y: 0},
			position: position(),
			
		}}
		class={`${props.color} ${props.role}`}
		data-role={props.role}
		data-color={props.color}
	></piece>
}

// export a toolbar control that lists all the pieces in ROLES and allows the user to select
// a piece to add to the board
// Define the ToolbarProps type
export type ToolbarProps = {
	// onPieceSelected: (role: Role) => void;
	// selectedPiece: Accessor<cg.Piece | null>;
	// setSelectedPiece: Setter<cg.Piece | null>;
	color: 'white' | 'black';
	onDrop?: (role: Role, color: Color, domPosition: DOMRect) => void;
};

export const PiecesToolbar = (props: ToolbarProps) => {


	// const handlePieceClick = (role: Role) => {
	// 	const piece: cg.Piece = {
	// 		role,
	// 		color: props.color
	// 	};
	// 	if (role !== props.selectedPiece()?.role || props.selectedPiece()?.color !== props.color)
	// 		props.setSelectedPiece(piece);
	// 	else
	// 		props.setSelectedPiece(null);
	// };

	return <div
	
		class="cg-wrap pieces-toolbar">
		{ROLES.map(role =>
			<Piece role={role} color={props.color} onDrop={props.onDrop} />
		)}
	</div>
}
