/** Config is generated only from platform-owned filenames and loopback bridge ports. */
export function workerdConfig(socketPort: number, proxyPort: number, token: string) {
	return `using Workerd=import "/workerd/workerd.capnp";const config:Workerd.Config=(services=[
 (name="main",worker=(modules=[(name="main.js",esModule=embed "main.js"),(name="bundle.js",esModule=embed "bundle.js"),(name="wire.js",esModule=embed "wire.js")],compatibilityDate="2026-07-01",globalOutbound="deny",bindings=[(name="REQUEST",service="bridge"),(name="TOKEN",text=${JSON.stringify(token)})])),
 (name="deny",worker=(modules=[(name="deny.js",esModule=embed "deny.js")],compatibilityDate="2026-07-01",globalOutbound="deny")),
 (name="bridge",external=(address="127.0.0.1:${proxyPort}",http=()))],sockets=[(name="http",address="127.0.0.1:${socketPort}",http=(),service="main")]);`;
}
