/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { useState } from "react";

export interface Item {
	id: string;
	label: string;
}

export interface State {
	items: Item[];
}
export interface SelectOptions {
	items: Item[];
	onSelect: (item: Item) => void;
	selected: string;
}

export const SelectList: React.FC<SelectOptions> = (options) => {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedItem, setSelectedItem] = useState<string | null>(null);

	const handleSelect = (item: Item) => {
		setSelectedItem(item.id);
		options.onSelect(item);
		setIsOpen(false);
	};

	const item: Item | undefined = options.items.find((item) => item.id === selectedItem);
	const label: string = item?.label ?? options.selected;
	return (
		<div className="relative w-full">
			<button onClick={() => setIsOpen(!isOpen)} className="bg-black/70 p-2 border rounded w-full text-left">
				{label}
			</button>
			{isOpen && (
				<ul className="absolute border mt-1 rounded shadow-lg bg-black/90 w-full z-100">
					{options.items.map((item) => (
						<li
							key={item.id}
							onClick={() => handleSelect(item)}
							className="p-2 cursor-pointer hover:bg-blue-100"
						>
							{item.label}
						</li>
					))}
				</ul>
			)}
		</div>
	);
};
