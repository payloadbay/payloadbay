import { createServer } from "node:http";

const receipts = [];
createServer(async (req, res) => {
	if (req.url === "/reset" && req.method === "POST") {
		receipts.length = 0;
		res.end("ok");

		return;
	}

	if (req.url === "/health") {
		res.end("ok");

		return;
	}

	if (req.method === "GET" && req.url === "/receipts") {
		res.setHeader("content-type", "application/json");
		res.end(JSON.stringify(receipts));

		return;
	}

	let size = 0;
	const chunks = [];
	for await (const chunk of req) {
		size += chunk.length;
		if (size > 1048576) {
			res.writeHead(413);
			res.end();

			return;
		}

		chunks.push(chunk);
	}

	const body = Buffer.concat(chunks);
	receipts.push({ method: req.method, path: req.url, body: body.toString("base64") });
	const status = req.url.match(/^\/status\/(\d{3})$/)?.[1];
	if (status) res.statusCode = Number(status);
	if (req.url === "/redirect") {
		res.statusCode = 302;
		res.setHeader("location", "/delivery");
	}

	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify({ status: res.statusCode, attemptId: "fixture", body: body.toString("base64") }));
}).listen(8080, "0.0.0.0");
