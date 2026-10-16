"use client";

import { Button, Modal } from "@heroui/react";
import { IconInfoCircle } from "@tabler/icons-react";

const ingressExample = `export async function POST(ctx: IngressContext): Promise<IngressDecision> {
	return ctx.accept({
		event: { body: ctx.request.body, contentType: ctx.request.contentType },
		response: { status: 202, body: "Accepted" },
	});
}

export async function GET(ctx: IngressContext): Promise<IngressDecision> {
	return ctx.respondOnly({ status: 200, body: "Endpoint ready" });
}`;

export function ScriptingGuide() {
	return (
		<Modal>
			<Button size='sm' variant='ghost'>
				<IconInfoCircle size={18} aria-hidden='true' />
				Scripting guide
			</Button>
			<Modal.Backdrop>
				<Modal.Container size='lg'>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>Writing Payload Bay scripts</Modal.Heading>
						</Modal.Header>
						<Modal.Body className='flex flex-col gap-5'>
							<section>
								<h3 className='font-semibold'>1. Receive a request</h3>
								<p className='text-muted mt-1 text-sm'>Use exported async functions with uppercase names, for example export async function POST(ctx: IngressContext): GET, POST, PUT, PATCH, DELETE, HEAD or OPTIONS. Only exported methods run; other methods receive HTTP 405 with an Allow header.</p>
								<pre className='bg-field mt-3 overflow-x-auto rounded-lg p-3 text-xs' tabIndex={0}>
									{ingressExample}
								</pre>
							</section>
							<section>
								<h3 className='font-semibold'>2. Choose what happens</h3>
								<p className='text-muted mt-1 text-sm'>
									<code>ctx.accept(...)</code> stores the event and queues processing before sending your response. <code>ctx.respondOnly(...)</code> replies without queueing delivery, useful for verification challenges. <code>ctx.reject(...)</code> rejects the request. Read the raw bytes and headers through <code>ctx.request</code>; verify signatures in your own code.
								</p>
							</section>
							<section>
								<h3 className='font-semibold'>3. Process the stored event</h3>
								<p className='text-muted mt-1 text-sm'>
									The separate processing script runs from the queue. Use <code>ctx.destinations.send(&quot;default&quot;, ...)</code> for managed delivery, then return <code>ctx.complete()</code>, <code>ctx.retry(...)</code> or <code>ctx.fail(...)</code>. A response to the sender does not mean delivery has finished. Retried operations should use stable operation IDs.
								</p>
							</section>
							<section>
								<h3 className='font-semibold'>Helpers and secrets</h3>
								<p className='text-muted mt-1 text-sm'>
									Create helper files under the project’s Code and middleware page. Bind a saved version in Helper imports, then the editor adds its ingress import as <code>import * as Helpers from &quot;@shared/Helpers&quot;;</code>. Processing imports are generated for its bindings. Bind secret versions by name and read them from <code>ctx.secrets.NAME</code>; never paste credentials into source.
								</p>
							</section>
							<section>
								<h3 className='font-semibold'>Save, test, publish</h3>
								<p className='text-muted mt-1 text-sm'>Requests with a valid ingress outcome are stored, including rejected and response-only requests. Only accepted events are queued for processing.</p>
								<p className='text-muted mt-1 text-sm'>Save formats the file with the project’s Prettier rules. Script test uses synthetic input and simulated delivery. To test the live route, send an HTTP request to its receiving URL after publishing. Publishing activates both stages for new events; stored events retain their original version.</p>
							</section>
							<section>
								<h3 className='font-semibold'>Read secret values</h3>
								<p className='text-muted mt-1 text-sm'>
									Create a secret key and value, then bind its version to a script key. Read it as <code>ctx.secrets.MY_KEY</code>. Keys are case-sensitive; missing keys are undefined. Values are available only when the script runs and are never written into its source. Dry tests use the synthetic secret values you supply.
								</p>
							</section>
						</Modal.Body>
						<Modal.Footer>
							<Button slot='close'>Got it</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
