import { pathToFileURL } from "node:url";

import { resolveProtocolAsset } from "@suite/desktop";
import { net, protocol } from "electron";

/**
 * The renderer's own origin.
 *
 * `file://` gives every page a privileged origin and is called out by Electron's
 * security checklist; `app://budget` is a real, secure origin instead. The
 * routes, the relative assets and the storage all keep working, and the page
 * cannot reach anything the policy does not name.
 */
export const APP_SCHEME = "app";
export const APP_HOST = "budget";
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
export const APP_ENTRY = `${APP_ORIGIN}/index.html`;

/**
 * The pages this app's window answers: its own bundle, and the dev server when
 * one is configured. Both the navigation guard and the IPC check use it, so a
 * page cannot be trusted by one and refused by the other.
 */
export function pageOrigins(): readonly string[] {
  const dev = process.env.ELECTRON_RENDERER_URL;
  return dev === undefined || dev === "" ? [APP_ORIGIN] : [APP_ORIGIN, dev];
}

/** Must run before `app.whenReady()`. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
  ]);
}

/** Serve the built renderer through the shared resolver. */
export function serveRenderer(root: string, csp: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const resolved = resolveProtocolAsset(request.url, root, {
      scheme: APP_SCHEME,
      hosts: [APP_HOST],
    });
    if (!resolved.ok) return new Response("not found", { status: 404 });

    // `net.fetch`, not the global: only this one can read a file URL.
    const response = await net.fetch(pathToFileURL(resolved.file).toString());
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", csp);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  });
}
