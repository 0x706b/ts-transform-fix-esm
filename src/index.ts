import * as ts from "typescript";

import { createRequireImport, createRequireStatement } from "./AST";
import { PluginConfig } from "./Types";
import { importExportVisitorFull, importExportVisitorSpecifierOnly } from "./Visitor";

type Mutable<T> = { -readonly [k in keyof T]: T[k] };

const transform = (_: ts.Program, config: PluginConfig): ts.TransformerFactory<ts.SourceFile> => (
   ctx
) => (sourceFile) => {
   const { visitedSourceFile, info } = config.createRequire
      ? importExportVisitorFull(ctx, sourceFile, config)
      : importExportVisitorSpecifierOnly(ctx, sourceFile, config);
   const generatedTopNodes = ts.factory.createNodeArray([
      ...info.esmImports,
      ...(info.shouldCreateRequire
         ? [
              createRequireImport(config.prefix),
              createRequireStatement(config.prefix),
              ...info.requires
           ]
         : []),
      ...info.destructureRequires
   ]);
   const generatedBottomNodes = ts.factory.createNodeArray([...info.esmExports]);
   const updatedStatements = ts.factory.createNodeArray([
      ...generatedTopNodes,
      ...visitedSourceFile.statements,
      ...generatedBottomNodes
   ]);
   const mutableSourceFile: Mutable<ts.SourceFile> = ts.getMutableClone(visitedSourceFile);
   mutableSourceFile.statements = updatedStatements;
   return mutableSourceFile;
};

export default transform;
