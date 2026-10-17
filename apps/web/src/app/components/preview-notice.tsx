export function PreviewNotice() {
	return (
		<aside aria-label='Preview mode' className='border-warning/40 bg-background border-b px-4 py-2 text-xs'>
			<strong>Disposable PR preview.</strong> Shared demo data resets on redeployment. Do not use production credentials or sensitive data. Use provider test webhooks only.
		</aside>
	);
}
