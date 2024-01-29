import React from "react";

interface InvitationProps {
	openInvitation: () => void;
}

const Invitation: React.FC<InvitationProps> = ({ openInvitation }) => {
	return (
		// <div className="rounded-3xl bg-white px-4 py-4 text-black hover:cursor-pointer" onClick={openInvitation}>
		// 	Invitation
		// </div>
		<div className="hover:cursor-pointer" onClick={openInvitation}>
			Invitation
		</div>
	);
};

export default Invitation;
