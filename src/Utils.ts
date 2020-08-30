import * as E from "fp-ts/lib/Either";
import * as F from "fp-ts/lib/function";
import * as A from "fp-ts/lib/ReadonlyNonEmptyArray";
import * as R from "fp-ts/lib/ReadonlyRecord";
import fs from "fs";
import path from "path";
import * as ts from "typescript";

import type {
   DefaultImport,
   Export,
   Import,
   ImportOrExport,
   NamedExport,
   NamedImport,
   NamespaceExport,
   NamespaceImport,
   PluginConfig
} from "./Types";

type PackageJson = R.ReadonlyRecord<string, any>;

export const readFile = (path: string): E.Either<null, Buffer> =>
   E.tryCatch(
      () => fs.readFileSync(path),
      () => null
   );

export const isDirectory = (path: string): boolean =>
   F.pipe(
      E.tryCatch(
         () => fs.lstatSync(path).isDirectory(),
         () => null
      ),
      E.fold(() => false, F.identity)
   );

export const recover = <E, A>(f: (e: E) => E.Either<E, A>) => (ma: E.Either<E, A>) =>
   F.pipe(
      ma,
      E.fold(f, () => ma)
   );

export const deepHasProperty = (obj: R.ReadonlyRecord<string, any>, key: string): boolean => {
   let hasKey = false;
   for (const k in obj) {
      if (k === key) {
         hasKey = true;
      } else if (typeof obj[k] == "object" && !Array.isArray(obj[k])) {
         hasKey = deepHasProperty(obj[k] as Record<string, unknown>, key);
      }
      if (hasKey) {
         break;
      }
   }
   return hasKey;
};

export const isImportOrExport = (node: ts.Node): node is ImportOrExport =>
   (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
   !!node.moduleSpecifier &&
   ts.isStringLiteral(node.moduleSpecifier);

export const isImport = (node: ts.Node): node is Import =>
   ts.isImportDeclaration(node) &&
   !!node.moduleSpecifier &&
   ts.isStringLiteral(node.moduleSpecifier) &&
   !!node.importClause;

export const isNamedImport = (node: Import): node is NamedImport =>
   !!node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings);

export const isDefaultImport = (node: Import): node is DefaultImport => !!node.importClause.name;

export const isNamespaceImport = (node: Import): node is NamespaceImport =>
   !!node.importClause.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings);

export const isSpecifierRelative = (node: ImportOrExport) => {
   const specifierText = node.moduleSpecifier.text;
   return (
      specifierText.startsWith("./") ||
      specifierText.startsWith("../") ||
      specifierText.startsWith("..")
   );
};

export const isExport = (node: ts.Node): node is Export =>
   ts.isExportDeclaration(node) &&
   !!node.moduleSpecifier &&
   ts.isStringLiteral(node.moduleSpecifier);

export const isNamespaceExport = (node: Export): node is NamespaceExport =>
   !!node.exportClause && ts.isNamespaceExport(node.exportClause);

export const isNamedExport = (node: Export): node is NamedExport =>
   !!node.exportClause && ts.isNamedExports(node.exportClause);

export const isESModule = (packageJSON: PackageJson) => packageJSON.type === "module";

export const isConditionalModule = (packageJSON: PackageJson) =>
   packageJSON.exports && deepHasProperty(packageJSON.exports, "import");

export const isOldESModule = (packageJSON: PackageJson) => packageJSON.module;

export const findPackageJSON = (prospectivePath: string): E.Either<null, Buffer> => {
   const folderPath = (prospectivePath.split("/") as unknown) as A.ReadonlyNonEmptyArray<string>;
   if (A.last(folderPath) === "node_modules") {
      return E.left(null);
   } else {
      return F.pipe(
         A.snoc(folderPath, "package.json"),
         (p) => readFile(p.join("/")),
         recover(() => F.pipe(folderPath, A.init, (p) => findPackageJSON(p.join("/"))))
      );
   }
};

export const getPackageJSON = (node: ImportOrExport, relativeProjectRoot?: string) => {
   const prospectivePath = path.resolve(
      relativeProjectRoot ?? process.cwd(),
      "node_modules",
      node.moduleSpecifier.text
   );
   return F.pipe(
      findPackageJSON(prospectivePath),
      E.chain((buf) =>
         F.pipe(
            E.parseJSON(buf.toString(), () => null),
            E.map((json) => json as PackageJson)
         )
      )
   );
};

export const isSpecifierExtensionEmpty = (node: ImportOrExport) =>
   path.extname(node.moduleSpecifier.text) === "";

export const isSpecifierExtensionUnknown = (
   node: ImportOrExport,
   ignoredExtensions?: ReadonlyArray<string>
) => {
   const extension = path.extname(node.moduleSpecifier.text);
   if (ignoredExtensions?.includes(extension)) return true;
   for (const key of Object.keys(import("./file-extensions.json"))) {
      if (key === " " || key === "") {
         continue;
      }
      if (extension === key || extension === key.toLowerCase()) {
         return false;
      }
   }
   return true;
};

export const createValidESMPath = (
   node: ImportOrExport,
   sourceFile: ts.SourceFile,
   config: PluginConfig,
   packageJSON?: PackageJson
): ts.StringLiteral => {
   const specifierText = node.moduleSpecifier.text;
   if (packageJSON) {
      if (specifierText === packageJSON.name) {
         return ts.createStringLiteral(
            `${specifierText}/${
               (packageJSON.main as string)?.replace("./", "") ||
               (
                  (packageJSON.exports?.["."] as string) ||
                  (packageJSON.exports?.import?.["."] as string)
               )?.replace("./", "") ||
               "index"
            }.${config.extension ?? "js"}`
         );
      }
   }
   if (isSpecifierExtensionEmpty(node) || isSpecifierExtensionUnknown(node, config.ignore)) {
      const absolutePath = isSpecifierRelative(node)
         ? path.resolve(
              path.parse(sourceFile.fileName).dir,
              specifierText === ".." ? "../" : specifierText
           )
         : path.resolve(
              config.relativeProjectRoot ?? process.cwd(),
              "node_modules",
              node.moduleSpecifier.text
           );
      return ts.createStringLiteral(
         isDirectory(absolutePath)
            ? `${specifierText}/index.${config.extension ?? "js"}`
            : `${specifierText}.${config.extension ?? "js"}`
      );
   } else {
      return node.moduleSpecifier;
   }
};
