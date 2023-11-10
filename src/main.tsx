/*
 *  Copyright (c) 2021-2022 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./i18n/i18n.ts";
import "./index.css";
import Call from "./pages/Call.tsx";
import ErrorPage from "./pages/ErrorPage.tsx";

const router = createBrowserRouter([
	{
		path: "/call",
		element: <Call />,
		errorElement: <ErrorPage />,
	},
	{
		path: "/call/:id",
		element: <Call />,
		errorElement: <ErrorPage />,
	},
	{
		path: "/",
		element: <></>,
		errorElement: <ErrorPage />,
	},
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<>
			<input type="hidden" name="app-version" value={__APP_VERSION__} />
			<RouterProvider router={router} />
		</>
	</React.StrictMode>
);
