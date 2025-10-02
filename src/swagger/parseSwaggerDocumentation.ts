// oxlint-disable prefer-await-to-then
import yaml from 'js-yaml';
import type { OpenAPIV2 } from "openapi-types";
import { Api } from "../core/Api.js";
import { removeTrailingSlash } from "../core/utils/index.js";
import handleJson from "./handleJson.js";

export interface ParsedSwaggerDocumentation {
  api: Api;
  response: OpenAPIV2.Document;
  status: number;
}

function parseOpenApi(text: string): OpenAPIV2.Document {
  const s = text.trim();
  // JSON?
  if (s.startsWith('{') || s.startsWith('[')) {
    return JSON.parse(s) as OpenAPIV2.Document;
  }
  // Otherwise assume YAML
  return yaml.load(s) as OpenAPIV2.Document;
}

async function fetchOpenApi(url: string): Promise<OpenAPIV2.Document> {
  const res = await fetch(url, {
    headers: {
      // be liberal in what we accept
      'Accept': 'application/json, application/yaml, text/yaml, text/plain;q=0.9, */*;q=0.5',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parseOpenApi(text);
}



export default function parseSwaggerDocumentation(
  entrypointUrl: string,
): Promise<ParsedSwaggerDocumentation> {
  entrypointUrl = removeTrailingSlash(entrypointUrl);
  const parseOpenApiText = (text: string): OpenAPIV2.Document => {
    const s = text.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      return JSON.parse(s) as OpenAPIV2.Document; // JSON path
    }
    return yaml.load(s) as OpenAPIV2.Document; // YAML path
  };

  return fetch(entrypointUrl)
    //.then((res) => Promise.all([res, res.json()]))
    .then((res) => res.text()
    .then((text) => [res, parseOpenApiText(text)] as [Response, OpenAPIV2.Document]),)
    .then(
      ([res, response]: [res: Response, response: OpenAPIV2.Document]) => {
        const title = response.info.title;
        const resources = handleJson(response, entrypointUrl);

        return {
          api: new Api(entrypointUrl, { title, resources }),
          response,
          status: res.status,
        };
      },
      ([res, response]: [res: Response, response: OpenAPIV2.Document]) => {
        // oxlint-disable-next-line no-throw-literal
        throw {
          api: new Api(entrypointUrl, { resources: [] }),
          response,
          status: res.status,
        };
      },
    );
}
