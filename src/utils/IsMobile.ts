export default function (): boolean {
	return window.matchMedia("(any-pointer:coarse)").matches;
}
