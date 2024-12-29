import { Accessor, For } from 'solid-js';
import { EngineInfo } from '../../engine/engineinterfaces';
import './EngineInfoViewer.scss'; // Create and import your custom styles

type EngineInfoViewerProps = {
    engineInfo: EngineInfo[];
};

const EngineInfoViewer = (props: EngineInfoViewerProps) => {
    console.log('EngineInfoViewer', props.engineInfo);
    return (
        <div class="engine-info-viewer">
            <For each={props.engineInfo}>
                {(info) => (
                    <div class="engine-info-row">
                        {/* <div class="engine-info-depth">Depth: {info.depth}</div> */}
                        <span class="engine-info-score has-background-info has-text-info-invert">
                            {info.score?.type === 'cp' ? info.score.value / 100 : `#${info.score?.value}`}
                        </span>
                        <For each={info.pv}>
                            {(move) => (
                                <span class="engine-info-pv-move">{move}</span>
                            )}
                        </For>
                        
                    </div>
                )}
            </For>
        </div>
    );
};

export default EngineInfoViewer;