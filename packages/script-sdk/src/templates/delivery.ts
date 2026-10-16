export const deliveryTemplate = {
	name: "Deliver to default destination",
	description: "Returns completion only after the managed destination succeeds. Non-success asks the platform to retry.",
	stage: "processing" as const,
	body: `	const delivery = await ctx.destinations.send("default", {
		operationId: "primary-delivery",
		body: ctx.event.body,
		headers: { "content-type": ctx.event.contentType },
	});

	return delivery.ok ? ctx.complete() : ctx.retry({ reason: "Destination delivery did not succeed" });`,
};
