/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				sans: "Lato",
			},
			colors: {
				grey: "rgb(132, 132, 132)",
				blue: "rgb(0, 174, 255)",
				red: "#fd605d",
			},
		},
	},
	plugins: [],
};
