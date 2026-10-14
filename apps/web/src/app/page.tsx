"use client";

import { Button } from "@heroui/react";
import { Sheet } from "@heroui-pro/react";

export default function Home() {
	return (
		<main className='mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8'>
			<h1 className='text-2xl font-semibold'>Payload Bay</h1>
			<p className='text-muted'>Application setup is in progress.</p>
			<Sheet>
				<Sheet.Trigger>
					<Button>View setup status</Button>
				</Sheet.Trigger>
				<Sheet.Backdrop>
					<Sheet.Content>
						<Sheet.Dialog>
							<Sheet.CloseTrigger />
							<Sheet.Header>
								<Sheet.Heading>Setup status</Sheet.Heading>
							</Sheet.Header>
							<Sheet.Body>
								<p>The application shell is ready. Backend setup follows.</p>
							</Sheet.Body>
						</Sheet.Dialog>
					</Sheet.Content>
				</Sheet.Backdrop>
			</Sheet>
		</main>
	);
}
