/*
 *  Copyright (c) 2021-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./i18n/i18n.ts";
import "./index.css";

const Call = lazy(() => import("./pages/Call.tsx"));
const ErrorPage = lazy(() => import("./pages/ErrorPage.tsx"));

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
	</React.StrictMode>,
);
