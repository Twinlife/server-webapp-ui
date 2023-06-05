export default function Header() {
	return (
		<div className="flex w-full items-center justify-between">
			<a href={import.meta.env.VITE_APP_WEBSITE} target="_blank" className="flex items-center justify-start">
				<img src={"/logo/" + import.meta.env.VITE_APP_LOGO} alt="" className="w-8" />
				<div className="ml-2 font-light text-grey">{import.meta.env.VITE_APP_NAME}</div>
			</a>
		</div>
	);
}
