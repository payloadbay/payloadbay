import type { AppLayoutProps } from "@types";
import { PreviewNotice } from "@components/preview-notice";

export default function AuthLayout({ children }: AppLayoutProps) {
	return (
		<>
			{process.env.IS_PREVIEW === "true" && (
				<div className='sticky top-0 z-40'>
					<PreviewNotice />
				</div>
			)}
			{children}
		</>
	);
}
