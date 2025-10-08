import type { OpenAPIV2, OpenAPIV3 } from "openapi-types";

export function getResourcePaths(
  paths: OpenAPIV2.PathsObject | OpenAPIV3.PathsObject,
): string[] {
  const nonMatching = Object.keys(paths).filter((path) => !RegExp("^[^{}]+/{[^{}]+}/?$").test(path));
  console.log("Non-matching paths:");
  for (const p of nonMatching) {
    console.log("  ", p);
  }

  const matching = Object.keys(paths).filter((path) => RegExp("^[^{}]+/{[^{}]+}/?$").test(path));
  console.log("Matching paths:");
  for (const p of matching) {
    console.log("  ", p);
  }    
  return [
    ...new Set(
      Object.keys(paths)
      //Object.keys(paths).filter((path) => new RegExp("^[^{}]+/{[^{}]+}/?$").test(path)),
    ),
  ];
}
