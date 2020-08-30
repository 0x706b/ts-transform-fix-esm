import path from "path";
import ts from "typescript";

import { DefaultImport, NamedExport, NamedImport, NamespaceExport, NamespaceImport } from "./Types";

/**
 * Used when import declaration renames import
 */
export const createDestructureStatementForImport = (
   node: ts.ImportDeclaration & {
      importClause: {
         name?: ts.Identifier;
         namedBindings: ts.NamedImports;
         propertyName?: ts.Identifier;
      };
      moduleSpecifier: ts.StringLiteral;
   }
) => {
   const bindings = node.importClause.namedBindings;
   const requireElements = bindings.elements.map((specifier) => {
      return ts.factory.createBindingElement(undefined, specifier.propertyName, specifier.name);
   });
   return ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
         [
            ts.factory.createVariableDeclaration(
               ts.factory.createObjectBindingPattern(requireElements),
               undefined,
               undefined,
               node.importClause.name
            )
         ],
         ts.NodeFlags.Const
      )
   );
};

export const createRequireStatementForImport = (node: NamedImport, prefix = "__") => {
   const bindings = node.importClause.namedBindings;
   const requireElements = bindings.elements.map((specifier) => {
      if (specifier.propertyName) {
         return ts.factory.createBindingElement(undefined, specifier.propertyName, specifier.name);
      }
      return ts.factory.createBindingElement(undefined, undefined, specifier.name);
   });
   return ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
         [
            ts.factory.createVariableDeclaration(
               ts.createObjectBindingPattern(requireElements),
               undefined,
               undefined,
               ts.factory.createCallExpression(ts.createIdentifier(prefix + "require"), undefined, [
                  ts.factory.createStringLiteral(node.moduleSpecifier.text)
               ])
            )
         ],
         ts.NodeFlags.Const
      )
   );
};

export const createRequireStatementForExport = (node: NamedExport, prefix = "__") => {
   const elements = node.exportClause.elements;
   const requireElements = elements.map((specifier) => {
      if (specifier.propertyName) {
         return ts.factory.createBindingElement(
            undefined,
            specifier.propertyName,
            prefix + specifier.name
         );
      }
      return ts.factory.createBindingElement(undefined, specifier.name, prefix + specifier.name);
   });
   return ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
         [
            ts.factory.createVariableDeclaration(
               ts.createObjectBindingPattern(requireElements),
               undefined,
               undefined,
               ts.factory.createCallExpression(ts.createIdentifier(prefix + "require"), undefined, [
                  ts.factory.createStringLiteral(node.moduleSpecifier.text)
               ])
            )
         ],
         ts.NodeFlags.Const
      )
   );
};

export const createExportDeclarationForNamedRequires = (node: NamedExport, prefix = "__") => {
   const elements = node.exportClause.elements.map((specifier) => {
      if (specifier.propertyName) {
         return ts.factory.createExportSpecifier(prefix + specifier.propertyName, specifier.name);
      }
      return ts.factory.createExportSpecifier(prefix + specifier.name, specifier.name);
   });
   return ts.factory.createExportDeclaration(
      node.decorators,
      node.modifiers,
      false,
      ts.factory.createNamedExports(elements)
   );
};

export const createRequireStatement = (prefix = "__") => {
   return ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
         [
            ts.factory.createVariableDeclaration(
               prefix + "require",
               undefined,
               undefined,
               ts.factory.createCallExpression(
                  ts.createIdentifier(prefix + "createRequire"),
                  undefined,
                  [
                     ts.factory.createPropertyAccessExpression(
                        ts.factory.createMetaProperty(
                           ts.SyntaxKind.ImportKeyword,
                           ts.factory.createIdentifier("meta")
                        ),
                        "url"
                     )
                  ]
               )
            )
         ],
         ts.NodeFlags.Const
      )
   );
};

export const createRequireImport = (prefix = "__") => {
   return ts.factory.createImportDeclaration(
      undefined,
      undefined,
      ts.factory.createImportClause(
         false,
         undefined,
         ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(
               ts.createIdentifier("createRequire"),
               ts.createIdentifier(prefix + "createRequire")
            )
         ])
      ),
      ts.factory.createStringLiteral("module")
   );
};

export const createDefaultImportForNamespaceImport = (
   node: NamespaceImport,
   specifier: ts.StringLiteral
) => {
   return ts.factory.createImportDeclaration(
      undefined,
      undefined,
      ts.factory.createImportClause(
         false,
         ts.factory.createIdentifier(node.importClause.namedBindings.name.text),
         undefined
      ),
      specifier
   );
};

export const createDefaultImportForNamespaceExport = (
   node: NamespaceExport,
   specifier: ts.StringLiteral,
   prefix = "__"
) =>
   ts.factory.createImportDeclaration(
      undefined,
      undefined,
      ts.factory.createImportClause(
         false,
         ts.factory.createIdentifier(prefix + node.exportClause.name.text),
         undefined
      ),
      specifier
   );

export const createDefaultImport = (node: DefaultImport, specifier: ts.StringLiteral) => {
   return ts.factory.createImportDeclaration(
      undefined,
      undefined,
      ts.factory.createImportClause(
         false,
         ts.createIdentifier(node.importClause.name.text),
         undefined
      ),
      specifier
   );
};

export const createNamedExportsForDefaultImport = (node: NamespaceExport, prefix = "__") =>
   ts.factory.createExportDeclaration(
      node.decorators,
      node.modifiers,
      false,
      ts.factory.createNamedExports([
         ts.factory.createExportSpecifier(prefix + node.exportClause.name, node.exportClause.name)
      ])
   );

export const createDefaultImportForDefaultExport = (specifier: ts.StringLiteral, prefix = "__") => {
   const identifier = ts.factory.createIdentifier(
      prefix +
         specifier.text
            .split("/")
            .map((v) =>
               v.includes(path.extname(specifier.text))
                  ? v.replace(path.extname(specifier.text), "")
                  : v
            )
            .map((v) => v.replace("-", "_"))
            .join("_")
   );
   const declaration = ts.factory.createImportDeclaration(
      undefined,
      undefined,
      ts.factory.createImportClause(false, identifier, undefined),
      specifier
   );
   return {
      declaration,
      identifier
   };
};
