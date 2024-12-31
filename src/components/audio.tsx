import moveAudio  from '/src/assets/sound/Move.mp3';
import captureAudio from '/src/assets/sound/Capture.mp3';
import checkAudio from '/src/assets/sound/Check.mp3';
import checkmateAudio from '/src/assets/sound/game-end.mp3';
import moveSelfAudio from '/src/assets/sound/move-self.mp3';
import moveOpponentAudio from '/src/assets/sound/move-opponent.mp3';
import { MoveFlags } from '../models/MoveFlags';

export async function PlayAudio(audio: string) {
    const a = new Audio(audio);
    a.play();
}




export async function PlayAudioForMove(flags: MoveFlags) {
    const { isCapture, isCheck, isCheckmate, isSelf } = flags;
    console.log("PlayAudioForMove", isCapture, isCheck, isCheckmate, isSelf);
    if(isCheckmate) {
        console.log("PlayAudioForMove checkmate");
        PlayAudio(checkmateAudio);
    } else if(isCheck) {
        console.log("PlayAudioForMove check");
        PlayAudio(checkAudio);
    } else if(isCapture) {
        console.log("PlayAudioForMove capture");
        PlayAudio(captureAudio);
    } else {
        if(isSelf) {
            console.log("PlayAudioForMove self");
            PlayAudio(moveSelfAudio);
        } else {
            console.log("PlayAudioForMove opponent");
            PlayAudio(moveOpponentAudio);
        }
        // PlayNormalMoveAudio();
    }
}