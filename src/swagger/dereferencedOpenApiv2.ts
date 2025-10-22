// oxlint-disable consistent-indexed-object-style
import type { OpenAPIV2 } from "openapi-types";

/**
 * SCHEMAS
 * OAS2 supports JSON Schema draft-04 subset.
 * Notably: no oneOf/anyOf/not (only allOf). Nullable is typically vendor ext (x-nullable).
 */
type BaseSchemaObjectDereferenced = Omit<
  OpenAPIV2.SchemaObject,
  "allOf" | "items" | "additionalProperties"
> & {
  allOf?: SchemaObjectDereferenced[];
  // In JSON Schema, items can be a schema or an array (tuples)
  items?: SchemaObjectDereferenced | SchemaObjectDereferenced[];
  additionalProperties?: boolean | SchemaObjectDereferenced;
};

interface ArraySchemaObjectDereferenced extends BaseSchemaObjectDereferenced {
  type: "array";
  items: SchemaObjectDereferenced | SchemaObjectDereferenced[];
}

interface NonArraySchemaObjectDereferenced
  extends BaseSchemaObjectDereferenced {
  // any JSON Schema primitive/object types except "array"
  type?: Exclude<OpenAPIV2.SchemaObject["type"], "array">;
}

export type SchemaObjectDereferenced =
  | ArraySchemaObjectDereferenced
  | NonArraySchemaObjectDereferenced;

/**
 * PARAMETERS
 * OAS2 has BodyParameter (with schema) and NonBody parameters (query, header, path, formData)
 * NonBody params do NOT have "schema"; they use type/items directly.
 */

export type BodyParameterObjectDereferenced = Omit<
  OpenAPIV2.InBodyParameterObject,
  "schema"
> & {
  in: "body"; // literal discriminant
  schema: SchemaObjectDereferenced;
};



/** Non-body: in: "query" | "header" | "path" | "formData" */
export type NonBodyParameterObjectDereferenced = Omit<
  OpenAPIV2.GeneralParameterObject,
  "items"
> & {
  in: "query" | "header" | "path" | "formData"; // literals
  items?: OpenAPIV2.ItemsObject; // only when type === "array"
};

export type ParameterObjectDereferenced =
  | BodyParameterObjectDereferenced
  | NonBodyParameterObjectDereferenced;

/**
 * HEADERS
 * OAS2 headers are simple types (no content map). No $ref on headers in the spec.
 */
type HeaderObjectDereferenced = OpenAPIV2.HeaderObject;

/**
 * RESPONSES
 * OAS2 ResponseObject has optional schema + headers (simple) + examples.
 */
type ResponseObjectDereferenced = Omit<
  OpenAPIV2.ResponseObject,
  "schema" | "headers"
> & {
  schema?: SchemaObjectDereferenced;
  headers?: {
    [header: string]: HeaderObjectDereferenced;
  };
};

interface ResponsesObjectDereferenced {
  [code: string]: ResponseObjectDereferenced;
}

/**
 * OPERATIONS & PATHS
 * No requestBody/content/encoding/callbacks in OAS2.
 */
export type OperationObjectDereferenced<T extends object = object> = Omit<
  OpenAPIV2.OperationObject,
  "parameters" | "responses"
> & {
  parameters?: ParameterObjectDereferenced[];
  responses: ResponsesObjectDereferenced;
} & T;

type PathItemObjectDereferenced<T extends object = object> = Omit<
  OpenAPIV2.PathItemObject,
  "parameters" | "get" | "put" | "post" | "delete" | "options" | "head" | "patch"
> & {
  parameters?: ParameterObjectDereferenced[];
  get?: OperationObjectDereferenced<T>;
  put?: OperationObjectDereferenced<T>;
  post?: OperationObjectDereferenced<T>;
  delete?: OperationObjectDereferenced<T>;
  options?: OperationObjectDereferenced<T>;
  head?: OperationObjectDereferenced<T>;
  patch?: OperationObjectDereferenced<T>;
};

interface PathsObjectDereferenced<
  T extends object = object,
  P extends object = object,
> {
  [pattern: string]: (PathItemObjectDereferenced<T> & P) | undefined;
}

/**
 * "Components" equivalents in OAS2 live under: definitions, parameters, responses, securityDefinitions.
 */
type DefinitionsObjectDereferenced = {
  [key: string]: SchemaObjectDereferenced;
};

type ParametersDefinitionsDereferenced = {
  [key: string]: ParameterObjectDereferenced;
};

type ResponsesDefinitionsDereferenced = {
  [key: string]: ResponseObjectDereferenced;
};

type SecurityDefinitionsDereferenced = OpenAPIV2.SecurityDefinitionsObject;

/**
 * The full dereferenced OAS2 document shape.
 */
export type OpenAPIV2DocumentDereferenced<T extends object = object> = Omit<
  OpenAPIV2.Document,
  "paths" | "definitions" | "parameters" | "responses" | "securityDefinitions"
> & {
  paths: PathsObjectDereferenced<T>;
  definitions?: DefinitionsObjectDereferenced;
  parameters?: ParametersDefinitionsDereferenced;
  responses?: ResponsesDefinitionsDereferenced;
  securityDefinitions?: SecurityDefinitionsDereferenced;
};
