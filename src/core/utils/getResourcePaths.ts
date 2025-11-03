import type { OpenAPIV2, OpenAPIV3 } from "openapi-types";

function filterPaths(paths: OpenAPIV2.PathsObject | OpenAPIV3.PathsObject){
  const pathMap = new Map<string, string>();
  const allPaths = Object.keys(paths);
  const finalPaths : string[] = [];
  for (const p of allPaths){
    const tempPath = p;
    if (/\/{[^}]+}\/?$/.test(p)){
      
      tempPath.replace(/\/{[^}]+}\/?$/, "");
    }

    let exists = false;
    for (const key in pathMap.keys()){
      if (key == tempPath){
        exists = true;
      }
    }
    if (exists){
      continue;
    }

    pathMap.set(tempPath, "asd");
    finalPaths.push(p);


  }
  //if ends with {id}, remove {id}, check if its in the map
  
  //if it is skip
  //if it's not, put without {id} in map, put with {id} in final list
  //return final list

  return finalPaths;

}



export function getResourcePaths(
  paths: OpenAPIV2.PathsObject | OpenAPIV3.PathsObject,
): string[] {
  return filterPaths(paths);
  //[
    //...new Set(
      //Object.keys(paths)
      //Object.keys(paths).filter((path) => new RegExp("^[^{}]+/{[^{}]+}/?$").test(path)),
    //),
  //];
}
