import { FC, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface ChatBoxInputProps {
	value: string;
	onChange: (ev: React.ChangeEvent<HTMLTextAreaElement>) => void;
	onSubmit: () => void;
}

const ChatBoxInput: FC<ChatBoxInputProps> = ({ value, onChange, onSubmit }) => {
	const textAreaRef = useRef<HTMLTextAreaElement>(null);
	const { t } = useTranslation();

	useEffect(() => {
		if (textAreaRef.current) {
			// We need to reset the height momentarily to get the correct scrollHeight for the textarea
			textAreaRef.current.style.height = "0px";
			const scrollHeight = textAreaRef.current.scrollHeight;

			// We then set the height directly, outside of the render loop
			// Trying to set this with state or a ref will product an incorrect value.
			textAreaRef.current.style.height = Math.min(scrollHeight, 80) + "px";
		}
	}, [textAreaRef, value]);

	return (
		<textarea
			rows={1}
			ref={textAreaRef}
			className="flex-1 resize-none rounded-2xl bg-white px-4  py-1 text-black focus:outline-none"
			value={value}
			placeholder={t<string>("conversation_activity_message")}
			onChange={onChange}
			onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (e.keyCode == 13 && !e.shiftKey) {
					e.preventDefault();
					onSubmit();
				}
				if (e.keyCode === 65 && (e.metaKey || e.ctrlKey)) {
					e.preventDefault();
					e.currentTarget.select();
				}
			}}
		/>
	);
};

export default ChatBoxInput;
