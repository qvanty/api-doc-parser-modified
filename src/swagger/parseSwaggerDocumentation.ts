// oxlint-disable prefer-await-to-then
import type { OpenAPIV2 } from "openapi-types";
import { Api } from "../core/Api.js";
import { removeTrailingSlash } from "../core/utils/index.js";
import handleJson from "./handleJson.js";
import { JSON_SCHEMA, load} from "js-yaml";


function isJson(text: string): boolean {
  const first = text.trimStart()[0];
  return first === "{" || first === "[";
}

function parseResponse(response: string){
  const isYaml = !isJson(response);
  const yamlOptions = {
    schema: JSON_SCHEMA,
    json: true
  }
  if (isYaml){
    return load(response, yamlOptions);
  } else {
    return JSON.parse(response);
  }
}


export interface ParsedSwaggerDocumentation {
  api: Api;
  response: OpenAPIV2.Document;
  status: number;
}

export default function parseSwaggerDocumentation(
  entrypointUrl: string,
): Promise<ParsedSwaggerDocumentation> {
  entrypointUrl = removeTrailingSlash(entrypointUrl);
  return fetch(entrypointUrl)
    .then((res) => Promise.all([res, res.text()]))
    .then(
      ([res, response]: [res: Response, response: string]) => {
        const parsedResponse = parseResponse(response);
      
        const title = parsedResponse.info.title;

        return handleJson(parsedResponse, entrypointUrl).then((resources) => ({
          api: new Api(entrypointUrl, {title, resources}),
          response: parsedResponse,
          status: res.status,
        }))
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
