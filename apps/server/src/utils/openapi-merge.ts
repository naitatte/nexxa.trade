import type { OpenAPIV3 } from "openapi-types";

type OpenApiDocument = OpenAPIV3.Document;
type PathItemObject = OpenAPIV3.PathItemObject;
type TagObject = OpenAPIV3.TagObject;
type ParameterObject = OpenAPIV3.ParameterObject;
type ReferenceObject = OpenAPIV3.ReferenceObject;

function ensureValidParameters(
  parameters: unknown[] | undefined
): (ParameterObject | ReferenceObject)[] | undefined {
  if (!parameters) return undefined;
  return parameters
    .filter((param): param is ParameterObject | ReferenceObject => {
      if (!param || typeof param !== "object") return false;
      if ("$ref" in param) return true;
      return "name" in param && typeof (param as ParameterObject).name === "string";
    })
    .map((param) => {
      if ("$ref" in param) return param as ReferenceObject;
      const paramObj = param as ParameterObject;
      return {
        ...paramObj,
        name: paramObj.name!,
      } as ParameterObject;
    });
}

export function normalizeBetterAuthSchema(
  schema: OpenApiDocument | Record<string, unknown>,
  basePath: string = "/api/auth"
): OpenApiDocument {
  const schemaDoc = schema as OpenApiDocument;
  normalizeOpenApiSchemas(schemaDoc);

  const normalized: OpenApiDocument = {
    ...schemaDoc,
    paths: {},
    tags: schemaDoc.tags?.map((tag: TagObject) => ({
      ...tag,
      name: tag.name || "Auth",
      description: tag.description || "Better Auth endpoints",
    })),
  };

  if (schemaDoc.paths) {
    for (const [path, pathItem] of Object.entries(schemaDoc.paths)) {
      if (pathItem && typeof pathItem === "object" && !("$ref" in pathItem)) {
        const normalizedPath = path.startsWith("/")
          ? `${basePath}${path}`
          : `${basePath}/${path}`;

        const pathItemObj = pathItem as PathItemObject;
        normalizeAuthTags(pathItemObj, path);
        
        const normalizedPathItem: PathItemObject = {
          ...pathItemObj,
          summary: pathItemObj.summary || getPathSummary(path),
          description: pathItemObj.description || getPathDescription(path),
        };
        
        if (normalizedPathItem.parameters) {
          normalizedPathItem.parameters = ensureValidParameters(normalizedPathItem.parameters);
        }
        
        const operations = [
          normalizedPathItem.get,
          normalizedPathItem.post,
          normalizedPathItem.put,
          normalizedPathItem.delete,
          normalizedPathItem.patch,
          normalizedPathItem.options,
          normalizedPathItem.head,
          normalizedPathItem.trace,
        ];
        
        for (const operation of operations) {
          if (operation && operation.parameters) {
            operation.parameters = ensureValidParameters(operation.parameters);
          }
        }
        
        normalized.paths![normalizedPath] = normalizedPathItem;
      }
    }
  }

  return normalized as OpenApiDocument;
}

function normalizeAuthTags(pathItem: PathItemObject, path: string): void {
  const operations = [
    pathItem.get,
    pathItem.post,
    pathItem.put,
    pathItem.delete,
    pathItem.patch,
    pathItem.options,
    pathItem.head,
    pathItem.trace,
  ];

  for (const operation of operations) {
    if (!operation) continue;
    const tag = path.includes("/admin") ? "Auth / Admin" : "Auth";
    operation.tags = [tag];
  }
}

function getPathSummary(path: string): string {
  const pathMap: Record<string, string> = {
    "/sign-in": "Iniciar sesión con email y contraseña",
    "/sign-up": "Registrar nuevo usuario",
    "/sign-out": "Cerrar sesión",
    "/session": "Obtener sesión actual",
    "/forget-password": "Solicitar restablecimiento de contraseña",
    "/reset-password": "Restablecer contraseña",
    "/resend-verification": "Reenviar email de verificación",
    "/verify-email": "Verificar email del usuario",
    "/change-password": "Cambiar contraseña",
    "/change-email": "Cambiar email",
    "/update-profile": "Actualizar perfil de usuario",
    "/delete-account": "Eliminar cuenta de usuario",
  };

  for (const [key, value] of Object.entries(pathMap)) {
    if (path.includes(key)) {
      return value;
    }
  }

  return "Endpoint de autenticación";
}

function getPathDescription(path: string): string {
  const descMap: Record<string, string> = {
    "/sign-in":
      "Autentica un usuario con email y contraseña. Retorna la sesión y cookies de autenticación.",
    "/sign-up":
      "Registra un nuevo usuario en el sistema. Requiere email y contraseña válidos.",
    "/sign-out":
      "Cierra la sesión actual del usuario y elimina las cookies de autenticación.",
    "/session":
      "Obtiene la información de la sesión actual del usuario autenticado.",
    "/forget-password":
      "Envía un email con un enlace para restablecer la contraseña del usuario.",
    "/reset-password":
      "Restablece la contraseña del usuario usando un token de restablecimiento.",
    "/resend-verification":
      "Reenvía el email de verificación al usuario registrado.",
    "/verify-email":
      "Verifica el email del usuario usando un token de verificación.",
    "/change-password":
      "Cambia la contraseña del usuario autenticado. Requiere la contraseña actual.",
    "/change-email":
      "Cambia el email del usuario autenticado. Requiere verificación del nuevo email.",
    "/update-profile":
      "Actualiza la información del perfil del usuario autenticado.",
    "/delete-account":
      "Elimina permanentemente la cuenta del usuario autenticado.",
  };

  for (const [key, value] of Object.entries(descMap)) {
    if (path.includes(key)) {
      return value;
    }
  }

  return "Endpoint de autenticación de Better Auth";
}

export function mergePaths(
  existing: OpenApiDocument["paths"],
  incoming: OpenApiDocument["paths"]
): OpenApiDocument["paths"] {
  const merged = { ...existing };

  if (incoming) {
    for (const [path, pathItem] of Object.entries(incoming)) {
      if (pathItem && typeof pathItem === "object" && !("$ref" in pathItem)) {
        const incomingItem = pathItem as PathItemObject;
        if (merged[path]) {
          const existingItem = merged[path];
          if (
            existingItem &&
            typeof existingItem === "object" &&
            !("$ref" in existingItem)
          ) {
            const existingItemObj = existingItem as PathItemObject;
            merged[path] = {
              ...existingItemObj,
              ...incomingItem,
              get: incomingItem.get || existingItemObj.get,
              post: incomingItem.post || existingItemObj.post,
              put: incomingItem.put || existingItemObj.put,
              delete: incomingItem.delete || existingItemObj.delete,
              patch: incomingItem.patch || existingItemObj.patch,
            } as PathItemObject;
          } else {
            merged[path] = incomingItem;
          }
        } else {
          merged[path] = incomingItem;
        }
      }
    }
  }

  return merged;
}

export function mergeTags(
  existing: OpenApiDocument["tags"],
  incoming: OpenApiDocument["tags"]
): OpenApiDocument["tags"] {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const existingMap = new Map<string, TagObject>(
    existing.map((tag: TagObject) => [tag.name, tag])
  );

  for (const tag of incoming) {
    const tagObj = tag as TagObject;
    if (!existingMap.has(tagObj.name)) {
      existingMap.set(tagObj.name, tagObj);
    } else {
      const existingTag = existingMap.get(tagObj.name)!;
      existingMap.set(tagObj.name, {
        ...existingTag,
        description: tagObj.description || existingTag.description,
        externalDocs: tagObj.externalDocs || existingTag.externalDocs,
      });
    }
  }

  return Array.from(existingMap.values());
}

export function mergeComponents(
  existing: OpenApiDocument["components"],
  incoming: OpenApiDocument["components"]
): OpenApiDocument["components"] {
  if (!incoming) return existing;
  if (!existing) return incoming;

  return {
    ...existing,
    ...incoming,
    schemas: {
      ...existing.schemas,
      ...incoming.schemas,
    },
    responses: {
      ...existing.responses,
      ...incoming.responses,
    },
    parameters: {
      ...existing.parameters,
      ...incoming.parameters,
    },
    examples: {
      ...existing.examples,
      ...incoming.examples,
    },
    requestBodies: {
      ...existing.requestBodies,
      ...incoming.requestBodies,
    },
    headers: {
      ...existing.headers,
      ...incoming.headers,
    },
    securitySchemes: {
      ...existing.securitySchemes,
      ...incoming.securitySchemes,
    },
    links: {
      ...existing.links,
      ...incoming.links,
    },
    callbacks: {
      ...existing.callbacks,
      ...incoming.callbacks,
    },
  };
}

export function mergeSecurity(
  existing: OpenApiDocument["security"],
  incoming: OpenApiDocument["security"]
): OpenApiDocument["security"] {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const merged = [...(existing || [])];

  for (const security of incoming) {
    const exists = merged.some((s) =>
      JSON.stringify(s) === JSON.stringify(security)
    );
    if (!exists) {
      merged.push(security);
    }
  }

  return merged.length > 0 ? merged : undefined;
}

export function adaptSchemasToDb(document: OpenApiDocument): void {
  if (!document.components?.schemas) return;

  for (const [name, schema] of Object.entries(document.components.schemas)) {
    if (schema && typeof schema === "object" && "properties" in schema) {
      const properties = schema.properties;
      if (properties && typeof properties === "object") {
        for (const [propName, propSchema] of Object.entries(properties)) {
          if (
            propSchema &&
            typeof propSchema === "object" &&
            "type" in propSchema
          ) {
            if (propSchema.type === "string" && propName.includes("At")) {
              propSchema.format = "date-time";
              propSchema.example = new Date().toISOString();
            }
          }
        }
      }
    }
  }
}

function normalizeOpenApiSchemas(document: OpenApiDocument): void {
  if (document.paths) {
    for (const pathItem of Object.values(document.paths)) {
      if (!pathItem || typeof pathItem !== "object" || "$ref" in pathItem) {
        continue;
      }

      normalizePathItemSchemas(pathItem as PathItemObject);
    }
  }

  if (document.components?.schemas) {
    for (const schema of Object.values(document.components.schemas)) {
      normalizeSchema(schema);
    }
  }

  if (document.components?.responses) {
    for (const response of Object.values(document.components.responses)) {
      normalizeResponse(response);
    }
  }

  if (document.components?.requestBodies) {
    for (const requestBody of Object.values(document.components.requestBodies)) {
      normalizeRequestBody(requestBody);
    }
  }

  if (document.components?.parameters) {
    for (const parameter of Object.values(document.components.parameters)) {
      normalizeParameter(parameter);
    }
  }

  if (document.components?.headers) {
    for (const header of Object.values(document.components.headers)) {
      normalizeHeader(header);
    }
  }
}

function normalizePathItemSchemas(pathItem: PathItemObject): void {
  if (pathItem.parameters) {
    const validParams = ensureValidParameters(pathItem.parameters);
    if (validParams) {
      pathItem.parameters = validParams;
      for (const parameter of pathItem.parameters) {
        normalizeParameter(parameter);
      }
    } else {
      delete pathItem.parameters;
    }
  }

  const operations = [
    pathItem.get,
    pathItem.post,
    pathItem.put,
    pathItem.delete,
    pathItem.patch,
    pathItem.options,
    pathItem.head,
    pathItem.trace,
  ];

  for (const operation of operations) {
    if (!operation) continue;
    normalizeOperationSchemas(operation);
  }
}

function normalizeOperationSchemas(
  operation: OpenAPIV3.OperationObject
): void {
  if (operation.parameters) {
    const validParams = ensureValidParameters(operation.parameters);
    if (validParams) {
      operation.parameters = validParams;
      for (const parameter of operation.parameters) {
        normalizeParameter(parameter);
      }
    } else {
      delete operation.parameters;
    }
  }

  if (operation.requestBody) {
    normalizeRequestBody(operation.requestBody);
  }

  if (operation.responses) {
    for (const response of Object.values(operation.responses)) {
      normalizeResponse(response);
    }
  }
}

function normalizeRequestBody(
  requestBody: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject
): void {
  if (!requestBody || "$ref" in requestBody) return;

  for (const media of Object.values(requestBody.content || {})) {
    if (media.schema) {
      normalizeSchema(media.schema);
    }
  }
}

function normalizeResponse(
  response: OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject
): void {
  if (!response || "$ref" in response) return;

  for (const media of Object.values(response.content || {})) {
    if (media.schema) {
      normalizeSchema(media.schema);
    }
  }
}

function normalizeParameter(
  parameter: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject
): void {
  if (!parameter || "$ref" in parameter) return;
  if (parameter.schema) {
    normalizeSchema(parameter.schema);
  }
}

function normalizeHeader(
  header: OpenAPIV3.HeaderObject | OpenAPIV3.ReferenceObject
): void {
  if (!header || "$ref" in header) return;
  if (header.schema) {
    normalizeSchema(header.schema);
  }
}

function normalizeSchema(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
): void {
  if (!schema || "$ref" in schema) return;

  if (Array.isArray(schema.type)) {
    const types = schema.type.filter(
      (type): type is string => typeof type === "string"
    );
    const nonNullTypes = types.filter((type) => type !== "null");
    const hasNull = types.length !== nonNullTypes.length;

    if (hasNull) {
      schema.nullable = true;
    }

    if (nonNullTypes.length === 1) {
      schema.type = nonNullTypes[0] as OpenAPIV3.NonArraySchemaObjectType;
    } else if (nonNullTypes.length > 1) {
      if (!schema.oneOf && !schema.anyOf && !schema.allOf) {
        schema.oneOf = nonNullTypes.map((type) => ({ 
          type: type as OpenAPIV3.NonArraySchemaObjectType 
        })) as (OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject)[];
      }
      delete schema.type;
    } else {
      delete schema.type;
    }
  }

  if (schema.type === "array" && !schema.items) {
    schema.items = {};
  }

  if (schema.properties) {
    for (const value of Object.values(schema.properties)) {
      normalizeSchema(value);
    }
  }

  if (schema.type === "array" && schema.items) {
    normalizeSchema(schema.items as OpenAPIV3.SchemaObject);
  }

  if (schema.oneOf) {
    for (const item of schema.oneOf) {
      normalizeSchema(item);
    }
  }

  if (schema.anyOf) {
    for (const item of schema.anyOf) {
      normalizeSchema(item);
    }
  }

  if (schema.allOf) {
    for (const item of schema.allOf) {
      normalizeSchema(item);
    }
  }

  if (schema.not) {
    normalizeSchema(schema.not);
  }

  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    normalizeSchema(schema.additionalProperties as OpenAPIV3.SchemaObject);
  }

  if (schema.oneOf) {
    normalizeLiteralTypeUnion(schema, "oneOf");
  }

  if (schema.anyOf) {
    normalizeLiteralTypeUnion(schema, "anyOf");
  }
}

function normalizeLiteralTypeUnion(
  schema: OpenAPIV3.SchemaObject,
  keyword: "oneOf" | "anyOf"
): void {
  const unionItems = schema[keyword];
  if (!unionItems || unionItems.length === 0) return;

  const allowedTypes = new Set([
    "string",
    "number",
    "integer",
    "boolean",
    "array",
    "object",
    "null",
  ]);

  const literalValues: string[] = [];
  for (const item of unionItems) {
    if (!item || "$ref" in item) {
      return;
    }

    const keys = Object.keys(item);
    if (keys.length !== 1 || keys[0] !== "type") {
      return;
    }

    if (typeof item.type !== "string" || allowedTypes.has(item.type)) {
      return;
    }

    literalValues.push(item.type);
  }

  if (literalValues.length === 0) return;

  schema.type = "string";
  schema.enum = Array.from(new Set(literalValues));
  delete schema[keyword];
}
