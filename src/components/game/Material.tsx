// display each player's material advantage

import { Color, defaultSetup, Material, Position, Role, roleToChar } from "chessops";
import { Accessor, Component, createMemo, JSXElement } from "solid-js";
import { getFigurine } from "../common/utils";
import { getMaterial } from "../../models/pgn";
import "./Material.scss";
type MaterialProps = {

    color: Color;
    position: Accessor<Position>;
}

const MaterialWon: Component<MaterialProps> = ({ color, position }) => {
    
    
    const material = createMemo(() => {
        const pos = position();
        const material = getMaterial(pos);
        const fullMaterial = Material.fromBoard(defaultSetup().board);
        const black = fullMaterial.white.subtract(material.white);
        const white = fullMaterial.black.subtract(material.black);
        const ret = {
            white,
            black,
        }
        return ret;
    });

    const sideMaterial = ()=>material()[color];

    const renderPieces = (count: number, icon: ()=>JSXElement) => {
        return Array(count).fill(null).map((_, i) => (
            <span class="chess-material-icon" data-test={i} >{icon()}</span>
        ));
    };

    const getFigForRole = (role: Role) => {
        let char = roleToChar(role);
        if(color === "black") { // Note: we are displaying the material from the perspective of the player
            char = char.toUpperCase();
        }
        return getFigurine(char);
    }

    return (
        <div class="chess-material">
            {sideMaterial().pawn > 0 && (
                <div class="chess-material-items">
                    {renderPieces(sideMaterial().pawn, getFigForRole("pawn"))}
                </div>
            )}
            {sideMaterial().knight > 0 && (
                <div class="chess-material-items">
                    {renderPieces(sideMaterial().knight, getFigForRole("knight"))}
                </div>
            )}
            {sideMaterial().bishop > 0 && (
                <div class="chess-material-items">
                    {renderPieces(sideMaterial().bishop, getFigForRole("bishop"))}
                </div>
            )}
            {sideMaterial().rook > 0 && (
                <div class="chess-material-items">
                    {renderPieces(sideMaterial().rook, getFigForRole("rook"))}
                </div>
            )}
            {sideMaterial().queen > 0 && (
                <div class="chess-material-items">
                    {renderPieces(sideMaterial().queen, getFigForRole("queen"))}
                </div>
            )}
        </div>
    );
};

export default MaterialWon;