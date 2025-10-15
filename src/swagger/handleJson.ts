import { classify, pluralize } from "inflection";
import type { OpenAPIV2 } from "openapi-types";
import { Field, Resource } from "../core/index.js";
import {
  buildEnumObject,
  getResourcePaths,
  getType,
  removeTrailingSlash,
} from "../core/utils/index.js";

export default function handleJson(
  response: OpenAPIV2.Document,
  entrypointUrl: string,
): Resource[] {
  const paths = getResourcePaths(response.paths);
  const entryUrl = new URL(entrypointUrl);
  entryUrl.pathname = entryUrl.pathname.replace(/\/sensoterra-api\.yaml\.php$/, "");
  const serverUrl = entryUrl.href;
  console.log(serverUrl);

  return paths.map((path) => {
    const splittedPath = removeTrailingSlash(path).split("/");
    var baseName;
    if(splittedPath[splittedPath.length-1] == "{id}"){
      baseName = splittedPath[splittedPath.length - 2]
    } else {
      baseName = splittedPath[splittedPath.length - 1];
    }
    console.log("working on: ", baseName);

    if (!baseName) {
      throw new Error("Invalid path: " + path);
    }

    const name = pluralize(baseName);
    const url = `${removeTrailingSlash(serverUrl)}/${name}`;

    const title = classify(baseName);

    if (!response.definitions) {
      throw new Error(); // @TODO
    }

    const definition = response.definitions[title];

    if (!definition) {
      throw new Error(); // @TODO
    }

    const { description = "", properties } = definition;

    if (!properties) {
      throw new Error(); // @TODO
    }

    const requiredFields = response.definitions?.[title]?.required ?? [];

    const fields = Object.entries(properties).map(
      
      ([fieldName, property]) =>
        new Field(fieldName, {
          id: null,
          range: null,
          type: getType(
            typeof property?.type === "string" ? property.type : "",
            property?.["format"] ?? "",
          ),
          enum: buildEnumObject(property.enum),
          reference: null,
          embedded: null,
          required: requiredFields.some((value) => value === fieldName),
          description: property.description || "",
        }),
    );
    const newResource = new Resource(name, url, {
      id: null,
      title,
      description,
      fields,
      readableFields: fields,
      writableFields: fields,
    });

    if(newResource.title == "/token"){
      console.dir(newResource, { depth: null, colors: true })
    }

    return newResource
  });
}
