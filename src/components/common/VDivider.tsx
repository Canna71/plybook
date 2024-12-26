export const VDivider = (props: { ref: HTMLDivElement | ((el: HTMLDivElement) => void) | undefined; }) => {
	return <div ref={props.ref!} class="v-divider">
		<div class="v-divider-line"></div>
	</div>;
};
