import { Role } from 'chessground/types';
import { Accessor, Setter } from 'solid-js';
import type * as cg from 'chessground/types';

// const roles is all values of Role type, using typescript

export const ROLES: Role[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

// export a Piece solid-js component that takes a role and color prop and renders a piece
// with the appropriate class name

export const Piece = (props: { role: Role, color: 'white' | 'black' }) => {
	return <piece draggable={true} class={`${props.color} ${props.role}`}
		onDragStart={(e) => {
			// e.dataTransfer!.effectAllowed = 'none';
			// e.dataTransfer!.dropEffect = 'none';
			// e.dataTransfer!.setData('text/plain', 'piece');
			console.log("onDragStart", e);
		}}
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
			<Piece role={role} color={props.color} />
		)}
	</div>
}
