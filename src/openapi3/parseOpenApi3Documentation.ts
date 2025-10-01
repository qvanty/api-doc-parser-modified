// oxlint-disable prefer-await-to-then
import type { OpenAPIV3 } from "openapi-types";
import { Api } from "../core/index.js";
import type { RequestInitExtended } from "../core/types.js";
import { removeTrailingSlash } from "../core/utils/index.js";
import handleJson from "./handleJson.js";

export interface ParsedOpenApi3Documentation {
  api: Api;
  response: OpenAPIV3.Document;
  status: number;
}

function replaceVersionInPathKeys(spec: any, replacement = "v1") {
  if (!spec?.paths || typeof spec.paths !== "object") return spec;

  const out = { ...spec, paths: {} as Record<string, any> };
  for (const [pathKey, value] of Object.entries(spec.paths)) {
    const newKey = pathKey.replace(/\{version\}/g, replacement);
    out.paths[newKey] = value;
  }
  return out;
}

export default function parseOpenApi3Documentation(
  entrypointUrl: string,
  options: RequestInitExtended = {},
): Promise<ParsedOpenApi3Documentation> {
  console.log("modified version\n");
  entrypointUrl = removeTrailingSlash(entrypointUrl);
  const headersObject =
    typeof options.headers === "function" ? options.headers() : options.headers;
  const headers = new Headers(headersObject);
  if (!headers.get("Accept")?.includes("application/vnd.openapi+json")) {
    headers.append("Accept", "application/vnd.openapi+json");
  }

  return fetch(entrypointUrl, { ...options, headers: headers })
    .then((res) => Promise.all([res, res.json()]))
    .then(
      ([res, response]: [res: Response, response: OpenAPIV3.Document]) => {
        console.log("gonna modify");
        const modified = replaceVersionInPathKeys(response);
        const title = response.info.title;
        return handleJson(modified, entrypointUrl).then((resources) => ({
          api: new Api(entrypointUrl, { title, resources }),
          response,
          status: res.status,
        }));
      },
      ([res, response]: [res: Response, response: OpenAPIV3.Document]) => {
        // oxlint-disable-next-line no-throw-literal
        throw {
          api: new Api(entrypointUrl, { resources: [] }),
          response,
          status: res.status,
        };
      },
    );
}
