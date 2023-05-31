/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				sans: "Lato",
			},
			keyframes: {
				bounceOnce: {
					"0%, 100%": {
						transform: "translateY(0)",
						"animation-timing-function": "cubic-bezier(0.8, 0, 1, 1)",
					},
					"50%": {
						transform: "translateY(25%)",
						"animation-timing-function": "cubic-bezier(0, 0, 0.2, 1)",
					},
				},
			},
			animation: {
				skaheX: "bounceOnce .5s",
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
