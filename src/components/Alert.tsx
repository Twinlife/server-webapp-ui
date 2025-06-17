/*
 *  Copyright (c) 2023-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import { Dialog, Transition } from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { FC, Fragment, ReactNode } from "react";

interface AlertProps {
	title: string;
	content: ReactNode;
	isOpen: boolean;
	onClose: () => void;
}

const Alert: FC<AlertProps> = ({ isOpen, onClose, title, content }) => {
	return (
		<Transition.Root show={isOpen} as={Fragment}>
			<Dialog as="div" className="relative z-30" onClose={onClose}>
				<Transition.Child
					as={Fragment}
					enter="ease-out duration-300"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="ease-in duration-200"
					leaveFrom="opacity-100"
					leaveTo="opacity-0"
				>
					<div className="fixed inset-0 bg-zinc-900/80 transition-opacity" />
				</Transition.Child>

				<div className="fixed inset-0 z-10 overflow-y-auto">
					<div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center sm:p-0">
						<Transition.Child
							as={Fragment}
							enter="ease-out duration-300"
							enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
							enterTo="opacity-100 translate-y-0 sm:scale-100"
							leave="ease-in duration-200"
							leaveFrom="opacity-100 translate-y-0 sm:scale-100"
							leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
						>
							<Dialog.Panel className="w-lg relative transform overflow-hidden rounded-lg bg-zinc-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
								<div className="sm:flex sm:items-start">
									<div className="bg-red-100 mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10">
										<ExclamationTriangleIcon className=" h-6 w-6 text-red" aria-hidden="true" />
									</div>
									<div className="mt-3 flex flex-1 flex-col text-center sm:ml-4 sm:mt-0 sm:text-left">
										<Dialog.Title as="h3" className="text-base font-semibold leading-6 text-white">
											{title}
										</Dialog.Title>
										<div className="mt-2">
											<div className="text-sm text-gray-300">{content}</div>
										</div>
									</div>
								</div>
							</Dialog.Panel>
						</Transition.Child>
					</div>
				</div>
			</Dialog>
		</Transition.Root>
	);
};

export default Alert;
