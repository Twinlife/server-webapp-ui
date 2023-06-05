export default function ErrorPage() {
	return (
		<main className="relative isolate min-h-full bg-white">
			<img
				src="https://twin.me/wp-content/uploads/2016/01/header.png"
				alt=""
				className="absolute inset-0 -z-10 h-full w-full object-cover object-top"
			/>
			<div className="mx-auto max-w-7xl px-6 py-32 text-center sm:py-40 lg:px-8">
				{/* <p className="text-base font-semibold leading-8 text-zinc-900">404</p> */}
				<h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl">Oops!</h1>
				<p className="mt-4 text-base text-zinc-900/70 sm:mt-6">Sorry, something went wrong.</p>
			</div>
		</main>
	);
}
