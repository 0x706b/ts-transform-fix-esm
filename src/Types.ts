import * as ts from "typescript";

export type ImportOrExport = (ts.ImportDeclaration | ts.ExportDeclaration) & {
   moduleSpecifier: ts.StringLiteral;
};

export type Import = ts.ImportDeclaration & {
   importClause: ts.ImportClause;
   moduleSpecifier: ts.StringLiteral;
};

export type NamedImport = Import & {
   importClause: ts.ImportClause & {
      namedBindings: ts.NamedImports;
   };
};

export type DefaultImport = Import & {
   importClause: ts.ImportClause & {
      name: ts.Identifier;
   };
};

export type NamespaceImport = Import & {
   importClause: ts.ImportClause & {
      namedBindings: ts.NamespaceImport;
   };
};

export type Export = ts.ExportDeclaration & {
   moduleSpecifier: ts.StringLiteral;
};

export type NamespaceExport = Export & {
   exportClause: ts.NamespaceExport & {
      name: ts.Identifier;
   };
};

export type NamedExport = Export & {
   exportClause: ts.NamedExports & {
      elements: ts.NodeArray<ts.ExportSpecifier>;
   };
};

export type PluginConfig = {
   extension?: string;
   ignore?: ReadonlyArray<string>;
   prefix?: string;
   relativeProjectRoot?: string;
};

export type VisitorInfo = {
   cjsExportStarIdentifiers: ts.Identifier[];
   destructureRequires: ts.VariableStatement[];
   esmExports: ts.ExportDeclaration[];
   esmImports: ts.ImportDeclaration[];
   exportStatements: ts.VariableStatement[];
   requires: ts.VariableStatement[];
   shouldCreateRequire: boolean;
};
