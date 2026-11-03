"use client";

import { useEffect } from "react";
import { Toast, toast } from "@heroui/react";

export function ToastHost() {
	return <Toast.Provider placement='bottom' style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }} />;
}

export function useFeedbackToast(error: string, success: string = "", titles: { error?: string; success?: string } = {}) {
	const errorTitle = titles.error ?? "Request failed";
	const successTitle = titles.success ?? "Success";

	useEffect(() => {
		if (!error) return;
		const id = toast.danger(errorTitle, { description: error, timeout: 8000 });

		return () => toast.close(id);
	}, [error, errorTitle]);

	useEffect(() => {
		if (!success) return;
		const id = toast.success(successTitle, { description: success, timeout: 5000 });

		return () => toast.close(id);
	}, [success, successTitle]);
}
