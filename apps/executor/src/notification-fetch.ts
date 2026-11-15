import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

const privateAddresses = new BlockList();
for (const [address, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 4],
	["240.0.0.0", 4],
] as const)
	privateAddresses.addSubnet(address, prefix, "ipv4");
const globallyRoutableV6 = new BlockList();
globallyRoutableV6.addSubnet("2000::", 3, "ipv6");
const specialV6 = new BlockList();
specialV6.addSubnet("2001::", 23, "ipv6");
specialV6.addSubnet("2001:db8::", 32, "ipv6");
const unsafeAddresses = new BlockList();
for (const [address, prefix] of [
	["0.0.0.0", 8],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["224.0.0.0", 4],
	["240.0.0.0", 4],
] as const)
	unsafeAddresses.addSubnet(address, prefix, "ipv4");
unsafeAddresses.addAddress("100.100.100.200", "ipv4");
const unsafeV6 = new BlockList();
unsafeV6.addSubnet("::", 96, "ipv6");
unsafeV6.addSubnet("::1", 128, "ipv6");
unsafeV6.addSubnet("::ffff:0:0", 96, "ipv6");
unsafeV6.addSubnet("fe80::", 10, "ipv6");
unsafeV6.addSubnet("ff00::", 8, "ipv6");
unsafeV6.addAddress("fd00:ec2::254", "ipv6");
unsafeV6.addAddress("fd20:ce::254", "ipv6");
unsafeV6.addSubnet("64:ff9b::", 96, "ipv6");
unsafeV6.addSubnet("64:ff9b:1::", 48, "ipv6");
unsafeV6.addSubnet("2002::", 16, "ipv6");

export function publicAddress(address: string) {
	const family = isIP(address);

	return family === 4 ? !privateAddresses.check(address, "ipv4") : family === 6 && globallyRoutableV6.check(address, "ipv6") && !specialV6.check(address, "ipv6");
}

/** Only deployment-controlled exact hostnames can opt notification adapters into private services. DNS is pinned to the connection. */
export async function notificationFetch(
	url: URL,
	init: {
		method: string;
		headers: Record<string, string>;
		body?: Buffer;
		signal: AbortSignal;
	},
	allowedHosts: readonly string[] = [],
) {
	if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("invalid_target");
	init.signal.throwIfAborted();
	const hostname = url.hostname.replace(/^\[|\]$/g, "");
	const family = isIP(hostname);
	const addresses = family ? [{ address: hostname, family }] : await lookup(hostname, { all: true, verbatim: true });
	const explicitlyAllowed = allowedHosts.includes(hostname.toLowerCase());
	if (!addresses.length || addresses.some(({ address, family }) => (family === 4 ? unsafeAddresses.check(address, "ipv4") : unsafeV6.check(address, "ipv6")) || (!explicitlyAllowed && !publicAddress(address)))) throw Error("notification_target_blocked");
	init.signal.throwIfAborted();
	const headers: Record<string, string> = { ...init.headers, "accept-encoding": "identity" };
	delete headers.host;

	return new Promise<Response>((resolve, reject) => {
		const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
			url,
			{
				method: init.method,
				headers,
				signal: init.signal,
				maxHeaderSize: 16384,
				lookup: (_host, options, callback) => {
					if (options.all) callback(null, addresses);
					else callback(null, addresses[0].address, addresses[0].family);
				},
			},
			async (reply) => {
				try {
					const chunks: Buffer[] = [];
					let bytes = 0;
					for await (const chunk of reply) {
						bytes += chunk.length;
						if (bytes > 1048576) throw Error("response_limit");
						chunks.push(chunk);
					}

					let body = Buffer.concat(chunks);
					const encoding = reply.headers["content-encoding"];
					if (encoding === "gzip") body = gunzipSync(body, { maxOutputLength: 1048576 });
					else if (encoding === "deflate") body = inflateSync(body, { maxOutputLength: 1048576 });
					else if (encoding === "br") body = brotliDecompressSync(body, { maxOutputLength: 1048576 });
					const outputHeaders = new Headers();
					for (const [name, value] of Object.entries(reply.headers)) if (value !== undefined && !["content-encoding", "content-length"].includes(name)) for (const entry of Array.isArray(value) ? value : [value]) outputHeaders.append(name, entry);
					resolve(new Response([204, 304].includes(reply.statusCode!) || init.method === "HEAD" ? null : Uint8Array.from(body), { status: reply.statusCode, headers: outputHeaders }));
				} catch (error) {
					reply.destroy();
					reject(error);
				}
			},
		);
		request.on("error", reject);
		request.end(init.body);
	});
}
