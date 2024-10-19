import "solid-js";

declare module "solid-js" {
	namespace JSX {
		interface IntrinsicElements {
			"piece": JSX.HTMLAttributes<HTMLDivElement>;
		}
	}
}


