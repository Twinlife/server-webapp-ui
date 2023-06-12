import { MouseEventHandler, PropsWithChildren } from "react";

interface WhiteButtonProps extends PropsWithChildren {
	className?: string;
	onClick: MouseEventHandler<HTMLButtonElement>;
}

const WhiteButton: React.FC<WhiteButtonProps> = ({ className, onClick, children }) => {
	return (
		<button className={["btn-white", className].join(" ")} onClick={onClick}>
			{children}
		</button>
	);
};

export default WhiteButton;
