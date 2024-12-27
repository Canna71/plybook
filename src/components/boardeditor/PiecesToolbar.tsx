import { Color, Role } from 'chessops';
import { ROLES } from '../common/Piece';
import { DraggablePiece } from './DraggablePiece';

// export a toolbar control that lists all the pieces in ROLES and allows the user to select
// a piece to add to the board
// Define the ToolbarProps type
export type ToolbarProps = {
	// onPieceSelected: (role: Role) => void;
	// selectedPiece: Accessor<cg.Piece | null>;
	// setSelectedPiece: Setter<cg.Piece | null>;
	color: Color;
	onDrop?: (role: Role, color: Color, domPosition: DOMRect) => void;
};

export const PiecesToolbar = (props: ToolbarProps) => {

	return <div

		class="cg-wrap pieces-toolbar">
		{ROLES.map(role => <DraggablePiece role={role} color={props.color} onDrop={props.onDrop} />
		)}
	</div>;
};
