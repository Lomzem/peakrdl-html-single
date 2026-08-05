import { dev } from "$app/environment";
import type { Handle } from "@sveltejs/kit";
import documentJson from "virtual:peakrdl-dev-document";

const marker = '{"marker":"__PEAKRDL_HTML_SINGLE_DOCUMENT__"}';

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      dev && documentJson ? html.replace(marker, documentJson) : html,
  });
};
