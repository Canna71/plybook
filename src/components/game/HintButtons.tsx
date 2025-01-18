import { IconBulbFilled } from "@tabler/icons-solidjs";
import { Component } from "solid-js";
import Button from "../common/Button";
import { HintType } from "./GameContext";

export type HintButtonsProps = {
    setHintType: (hintType: HintType) => void;

};

const HintButtons : Component<HintButtonsProps> = (props) => {

    
    const onHintPiece = () => {
        // setModalVisible(!modalVisible());
        props.setHintType(HintType.Piece);
    };

    const onHintMove = () => {
        props.setHintType(HintType.Move);
    };

    return (
        
            <div class="pgnviewer-buttonbar are-small">
                <Button onClick={onHintPiece} title="Suggest Piece">
                    <IconBulbFilled />
                    <span>Piece</span>
                </Button>
                <Button onClick={onHintMove} title="Suggest Move">
                    <IconBulbFilled />
                    <span>Move</span>
                </Button>
            </div>
    );
};

export default HintButtons;
