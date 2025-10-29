import { camelize, classify, pluralize } from "inflection";
import type { OpenAPIV2 } from "openapi-types";
import { parse } from "jsonref";
import type { ParseOptions } from "jsonref";
import { Field, Operation, Parameter, Resource, type FieldType, type OperationType } from "../core/index.js";
import {
  buildEnumObject,
  getResourcePaths,
  getType,
  removeTrailingSlash,
} from "../core/utils/index.js";
import type {
  BodyParameterObjectDereferenced,
  OpenAPIV2DocumentDereferenced,
  OperationObjectDereferenced,
  SchemaObjectDereferenced,
} from "./dereferencedOpenApiv2.js";


function dereferenceOpenAPIV2(
  response: OpenAPIV2.Document,
  options: ParseOptions,
): Promise<OpenAPIV2DocumentDereferenced> {
  return parse(response, options);
}


function getArrayType(property: SchemaObjectDereferenced) {
  if (property.type !== "array") {
    return null;
  }
  return getType(property.type || "string", property["format"]);
}

export function getTypeModified(openApiType: string | string[] | undefined, format?: string): FieldType {
  let resolvedType: string;
  if (Array.isArray(openApiType)){
    resolvedType = (openApiType.find(t => t !== "null") ?? openApiType[0] ?? "string");
  } else{
    resolvedType = (openApiType ?? "string");
  }
  if (format) {
    switch (format) {
      case "int32":
      case "int64":
        return "integer";
      default:
        return camelize(format.replace("-", "_"), true);
    }
  }

  return resolvedType;
}

function buildResourceFromSchema(
  schema: SchemaObjectDereferenced,
  name: string,
  title: string,
  url: string,
) {
  //description is a level higher might be a problem later
  const description = schema['description'] ?? "";
  const properties: Record<string, SchemaObjectDereferenced> = schema['properties'] ?? {};
  const requiredFields = schema['required'] || [];
  const fields: Field[] = [];
  const readableFields: Field[] = [];
  const writableFields: Field[] = [];

  for (const [fieldName, property] of Object.entries(properties)) {
    const field = new Field(fieldName, {
      id: null,
      range: null,
      type: getTypeModified(property.type || "string", property["format"]),
      arrayType: getArrayType(property),
      enum: buildEnumObject(property["enum"]),
      reference: null,
      embedded: null,
      nullable: property["nullable"] || false,
      required: requiredFields.some((value: string) => value === fieldName),
      description: property["description"] || "",
    });

    if (!property["writeOnly"]) {
      readableFields.push(field);
    }
    if (!property["readOnly"]) {
      writableFields.push(field);
    }
    fields.push(field);
  }
  return new Resource(name, url, {
    id: null,
    title,
    description,
    fields,
    readableFields,
    writableFields,
    parameters: [],
    // oxlint-disable-next-line prefer-await-to-then
    getParameters: () => Promise.resolve([]),
  });
}

function mergeResources(resourceA: Resource, resourceB: Resource) {
  for (const fieldB of resourceB.fields ?? []) {
    if (!resourceA.fields?.some((fieldA) => fieldA.name === fieldB.name)) {
      resourceA.fields?.push(fieldB);
    }
  }
  for (const fieldB of resourceB.readableFields ?? []) {
    if (
      !resourceA.readableFields?.some((fieldA) => fieldA.name === fieldB.name)
    ) {
      resourceA.readableFields?.push(fieldB);
    }
  }
  for (const fieldB of resourceB.writableFields ?? []) {
    if (
      !resourceA.writableFields?.some((fieldA) => fieldA.name === fieldB.name)
    ) {
      resourceA.writableFields?.push(fieldB);
    }
  }

  return resourceA;
}

function buildOperationFromPathItem(
  httpMethod: `${OpenAPIV2.HttpMethods}`,
  operationType: OperationType,
  pathItem: OperationObjectDereferenced,
): Operation {
  return new Operation(pathItem.summary || operationType, operationType, {
    method: httpMethod.toUpperCase(),
    deprecated: !!pathItem.deprecated,
  });
}

function assignResourceRelationships(resources: Resource[]) {
  for (const resource of resources) {
    for (const field of resource.fields ?? []) {
      const name = camelize(field.name).replace(/Ids?$/, "");

      const guessedResource = resources.find(
        (res) => res.title === classify(name),
      );
      if (!guessedResource) {
        continue;
      }
      field.maxCardinality = field.type === "array" ? null : 1;
      if (field.type === "object" || field.arrayType === "object") {
        field.embedded = guessedResource;
      } else {
        field.reference = guessedResource;
      }
    }
  }
  return resources;
}

export default async function handleJson(
  response: OpenAPIV2.Document,
  entrypointUrl: string,
): Promise<Resource[]> {

  const document = await dereferenceOpenAPIV2(response, {
    scope: entrypointUrl,
  });

  const paths = getResourcePaths(response.paths);
  const entryUrl = new URL(entrypointUrl);
  entryUrl.pathname = entryUrl.pathname.replace(/\/sensoterra-api\.yaml\.php$/, "");
  const serverUrl = entryUrl.href;
  console.log(serverUrl);

  let resources = new Map<string, Resource>();
  
  for (const path of paths) {
    const splittedPath = removeTrailingSlash(path).split("/");
    var baseName;
    if(splittedPath[splittedPath.length-1]?.includes("{")){
      baseName = splittedPath[splittedPath.length - 2]
    } else {
      baseName = splittedPath[splittedPath.length - 1];
    }
    console.log("working on: ", baseName);

    if (!baseName) {
      throw new Error("Invalid path: " + path);
    }

    const name = baseName;
    const url = `${removeTrailingSlash(serverUrl)}/${baseName}`;
    const pathItem = document.paths[path];
    // if(path.includes("customer")){
    //   console.log(pathItem);
    // }
    
    if (!pathItem) {
      throw new Error(" " + path +" couldn't be accessed" );
    }

    //const title = classify(baseName);
    const title = baseName;
    const {
      get: showOperation,
      put: putOperation,
      patch: patchOperation,
      delete: deleteOperation,
      post: postOperation,
    } = pathItem;


    const editOperation = putOperation || patchOperation;
    if (!showOperation && !editOperation && !deleteOperation && !postOperation) {
      console.log("first out");
      continue;
    }
    const showSchema =
      showOperation?.responses?.["200"]?.schema || document.definitions?.[title];

    const editSchema = editOperation?.parameters?.find(p => (p as any).in === "body")?.schema;
    //@ts-ignore
    const deleteSchema = deleteOperation?.parameters?.find(p => (p as any).in === "body")?.schema ?? deleteOperation?.responses?.["200"]?.schema ??(deleteOperation?.responses?.["200"]?.type ? deleteOperation.responses["200"] : null);
    const postSchema = postOperation?.parameters?.find(p => (p as any).in === "body")?.schema;
    

    


    

    if (!showSchema && !editSchema && !deleteSchema && !postSchema) {
      console.log("second out");
      continue;
    }

    const showResource = showSchema
      ? buildResourceFromSchema(showSchema, name, title, url)
      : null;
    const editResource = editSchema
      ? buildResourceFromSchema(editSchema, name, title, url)
      : null;
    const deleteResource = deleteSchema
      ? buildResourceFromSchema(deleteSchema, name, title, url)
      : null;
    const postResource = postSchema
      ? buildResourceFromSchema(postSchema, name, title, url)
      : null;    
    //let resource = showResource ?? editResource ?? deleteResource ?? postResource;
  



    const candidates = [showResource, editResource, deleteResource, postResource];

    let resource: Resource | null = null;
    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      if (resource) {
        resource = mergeResources(resource, candidate);
      } else {
        resource = candidate;
      }
    }
    if (!resource) {
      console.log("third out");
      continue;
    }
    if (showResource && editResource) {
      resource = mergeResources(showResource, editResource);
    }


    //const pathCollection = Object.entries(document.paths).find(([path]) => path.endsWith(`/${name}`))?.[1];
    const pathCollection = Object.entries(document.paths).find(([path]) => path.includes(`/$name`))?.[1];
    const { get: listOperation, post: createOperation, delete: secondDeleteOperation } = pathCollection ?? {};

    resource.operations = [
      ...(showOperation
        ? [buildOperationFromPathItem("get", "show", showOperation)]
        : []),
      ...(putOperation
        ? [buildOperationFromPathItem("put", "edit", putOperation)]
        : []),
      ...(patchOperation
        ? [buildOperationFromPathItem("patch", "edit", patchOperation)]
        : []),
      ...(deleteOperation
        ? [buildOperationFromPathItem("delete", "delete", deleteOperation)]
        : []),
      ...(listOperation
        ? [buildOperationFromPathItem("get", "list", listOperation)]
        : []),
      ...(postOperation
        ? [buildOperationFromPathItem("post", "create", postOperation)]
        : []),
      ...(secondDeleteOperation
        ? [buildOperationFromPathItem("delete", "delete", secondDeleteOperation)]
        : []),
    ];

    if (listOperation?.parameters) {
          console.log("inside parameter thingy");
          resource.parameters = listOperation.parameters.map(
            (parameter) =>
              new Parameter(
                parameter["name"],
                parameter.schema?.type ? getType(parameter.schema.type) : null,
                parameter["required"] || false,
                parameter["description"] || "",
                parameter["deprecated"],
              ),
          );
    }
        
    let exists = false;
    const keys = Array.from(resources.keys());
    for (const key of keys){
      if (resource.title == key){
        console.log("matching titles: ", resource.title, " - ", key);
        exists = true;
      }
    }
    if (!exists){
      console.log("added resource title: ", resource.title)
      resources.set(resource.title ?? "no title", resource);
    }


        
  }
    
  const resourceList : Resource[] = Array.from(resources.values());
    
  return assignResourceRelationships(resourceList);
}  



  // return paths.map((path) => {
  //   const splittedPath = removeTrailingSlash(path).split("/");
  //   var baseName;
  //   if(splittedPath[splittedPath.length-1] == "{id}"){
  //     baseName = splittedPath[splittedPath.length - 2]
  //   } else {
  //     baseName = splittedPath[splittedPath.length - 1];
  //   }
  //   console.log("working on: ", baseName);

  //   if (!baseName) {
  //     throw new Error("Invalid path: " + path);
  //   }

  //   const name = pluralize(baseName);
  //   const url = `${removeTrailingSlash(serverUrl)}/${name}`;

  //   const title = classify(baseName);

  //   //logic to find the corresponding definition
  //   //for  every path iterate through methods (get/post etc)
  //   //find schema reference in method
  //   //set definition
  //   //


  //   //TODO: create logic for having multiple operation per resource
  //   //TODO: create final resource with multiple operations

  //   const pathItem = response.paths["/" +baseName];
  //   if (!pathItem) {
  //     throw new Error("incorrect path item");
  //   }
  //   const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

  //   for (const method of HTTP_METHODS) {
  //     const operation = (pathItem as any)[method];
  //     console.log(method);
  //     console.log(operation);
  //     if (!operation) {
  //       continue;
  //     } 
  //     operation.properties.schema;
  //   }
    
  //   const {
  //     get: showOperation,
  //     put: putOperation,
  //     patch: patchOperation,
  //     delete: deleteOperation,
  //   } = pathItem;
  //   showOperation;
  //   putOperation;
  //   patchOperation;
  //   deleteOperation;
    





















  //   if (!response.definitions) {
  //     throw new Error("no definitions found"); // @TODO
  //   }

  //   const definition = response.definitions[title] ?? undefined;

  //   if (!definition) {
  //     throw new Error("path not in definitions"); // @TODO
  //   } 

  //   const { description = "", properties } = definition;

  //   if (!properties) {
  //     throw new Error("properties empty"); // @TODO
  //   }

  //   const requiredFields = response.definitions?.[title]?.required ?? [];

  //   const fields = Object.entries(properties).map(
      
  //     ([fieldName, property]) =>
  //       new Field(fieldName, {
  //         id: null,
  //         range: null,
  //         type: getType(
  //           typeof property?.type === "string" ? property.type : "",
  //           property?.["format"] ?? "",
  //         ),
  //         enum: buildEnumObject(property.enum),
  //         reference: null,
  //         embedded: null,
  //         required: requiredFields.some((value) => value === fieldName),
  //         description: property.description || "",
  //       }),
  //   );
  //   const newResource = new Resource(name, url, {
  //     id: null,
  //     title,
  //     description,
  //     fields,
  //     readableFields: fields,
  //     writableFields: fields,
  //   });

  //   if(newResource.title == "/token"){
  //     console.dir(newResource, { depth: null, colors: true })
  //   }

  //   return newResource
  // });
// }
