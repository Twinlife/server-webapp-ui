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

const router = createBrowserRouter([
	{
		path: "/call",
		element: <Call />,
	},
	{
		path: "/call/:id",
		element: <Call />,
	},
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>
);
