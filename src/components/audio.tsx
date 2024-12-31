import moveAudio  from '/src/assets/sound/Move.mp3';
import captureAudio from '/src/assets/sound/Capture.mp3';
import checkAudio from '/src/assets/sound/Check.mp3';
import checkmateAudio from '/src/assets/sound/game-end.mp3';
import moveSelfAudio from '/src/assets/sound/move-self.mp3';
import moveOpponentAudio from '/src/assets/sound/move-opponent.mp3';

export async function PlayAudio(audio: string) {
    const a = new Audio(audio);
    a.play();
}




export async function PlayAudioForMove(isCapture: boolean, isCheck: boolean, isCheckmate: boolean, isSelf: boolean) {
    console.log("PlayAudioForMove", isCapture, isCheck, isCheckmate, isSelf);
    if(isCheckmate) {
        PlayAudio(checkmateAudio);
    } else if(isCheck) {
        PlayAudio(checkAudio);
    } else if(isCapture) {
        PlayAudio(captureAudio);
    } else {
        if(isSelf) {
            PlayAudio(moveSelfAudio);
        } else {
            PlayAudio(moveOpponentAudio);
        }
        // PlayNormalMoveAudio();
    }
}