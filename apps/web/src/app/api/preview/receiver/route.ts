/** Local demo sink: exercises real worker HTTP without forwarding data to a third party. */
export async function POST() {
	if (process.env.IS_PREVIEW !== "true") return new Response(null, { status: 404 });

	return new Response(null, { status: 204 });
}
