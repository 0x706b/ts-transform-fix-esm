import * as A from "fp-ts/lib/Array";
import * as M from "fp-ts/lib/Monoid";
import module from "module";
import * as ts from "typescript";

import {
   createDefaultImport,
   createDefaultImportForNamespaceExport,
   createDefaultImportForNamespaceImport,
   createDestructureStatementForImport,
   createExportDeclarationForNamedRequires,
   createNamedExportsForDefaultImport,
   createRequireStatementForExport,
   createRequireStatementForImport
} from "./AST";
import { PluginConfig, VisitorInfo } from "./Types";
import {
   createValidESMPath,
   getPackageJSON,
   isConditionalModule,
   isDefaultImport,
   isESModule,
   isExport,
   isImport,
   isImportOrExport,
   isNamedExport,
   isNamedImport,
   isNamespaceExport,
   isNamespaceImport,
   isSpecifierRelative
} from "./Utils";

const VisitorInfoM = M.getStructMonoid<VisitorInfo>({
   cjsExportStarIdentifiers: A.getMonoid(),
   destructureRequires: A.getMonoid(),
   esmExports: A.getMonoid(),
   esmImports: A.getMonoid(),
   exportStatements: A.getMonoid(),
   requires: A.getMonoid(),
   shouldCreateRequire: M.monoidAny
});

export const importExportVisitorSpecifierOnly = (
   ctx: ts.TransformationContext,
   sourceFile: ts.SourceFile,
   config: PluginConfig
): { info: VisitorInfo; visitedSourceFile: ts.SourceFile } => {
   const visitorInfo = { ...VisitorInfoM.empty };
   const visitor = (info: VisitorInfo) => (node: ts.Node): ts.Node | undefined => {
      let newInfo = { ...VisitorInfoM.empty };
      if (isImportOrExport(node)) {
         const specifierText = node.moduleSpecifier.text;
         if (isSpecifierRelative(node)) {
            if (isImport(node)) {
               newInfo = {
                  ...VisitorInfoM.empty,
                  esmImports: [
                     ts.createImportDeclaration(
                        node.decorators,
                        node.modifiers,
                        node.importClause,
                        createValidESMPath(node, sourceFile, config)
                     )
                  ]
               };
            } else if (isExport(node)) {
               newInfo = {
                  ...VisitorInfoM.empty,
                  esmExports: [
                     ts.createExportDeclaration(
                        node.decorators,
                        node.modifiers,
                        node.exportClause,
                        createValidESMPath(node, sourceFile, config)
                     )
                  ]
               };
            }
         } else if (module.builtinModules.includes(specifierText)) {
            if (isImport(node)) {
               newInfo = {
                  ...VisitorInfoM.empty,
                  esmImports: [node]
               };
            } else if (isExport(node)) {
               newInfo = {
                  ...VisitorInfoM.empty,
                  esmExports: [node]
               };
            }
         } else {
            const packageJSON = getPackageJSON(node, config.relativeProjectRoot);
            if (packageJSON) {
               if (isImport(node)) {
                  newInfo = {
                     ...VisitorInfoM.empty,
                     esmImports: [
                        ts.createImportDeclaration(
                           node.decorators,
                           node.modifiers,
                           node.importClause,
                           createValidESMPath(node, sourceFile, config, packageJSON)
                        )
                     ]
                  };
               } else if (isExport(node)) {
                  newInfo = {
                     ...VisitorInfoM.empty,
                     esmExports: [
                        ts.createExportDeclaration(
                           node.decorators,
                           node.modifiers,
                           node.exportClause,
                           createValidESMPath(node, sourceFile, config, packageJSON)
                        )
                     ]
                  };
               }
            }
         }

         info.esmExports = info.esmExports.concat(...newInfo.esmExports);
         info.esmImports = info.esmImports.concat(...newInfo.esmImports);
         return undefined;
      } else {
         return ts.visitEachChild(node, visitor(info), ctx);
      }
   };
   const visitedSourceFile = ts.visitEachChild(sourceFile, visitor(visitorInfo), ctx);
   return {
      info: visitorInfo,
      visitedSourceFile
   };
};

export const importExportVisitorFull = (
   ctx: ts.TransformationContext,
   sourceFile: ts.SourceFile,
   config: PluginConfig
): { info: VisitorInfo; visitedSourceFile: ts.SourceFile } => {
   const visitorInfo = { ...VisitorInfoM.empty };
   const visitor = (info: VisitorInfo) => (node: ts.Node): ts.Node | undefined => {
      let newInfo = { ...VisitorInfoM.empty };
      if (isImportOrExport(node)) {
         const specifierText = node.moduleSpecifier.text;
         if (isSpecifierRelative(node)) {
            // Relative path, so only create a valud ESM specifier
            newInfo = isImport(node)
               ? {
                    ...VisitorInfoM.empty,
                    esmImports: [
                       ts.createImportDeclaration(
                          node.decorators,
                          node.modifiers,
                          node.importClause,
                          createValidESMPath(node, sourceFile, config)
                       )
                    ]
                 }
               : isExport(node)
               ? {
                    ...VisitorInfoM.empty,
                    esmExports: [
                       ts.createExportDeclaration(
                          node.decorators,
                          node.modifiers,
                          node.exportClause,
                          createValidESMPath(node, sourceFile, config)
                       )
                    ]
                 }
               : VisitorInfoM.empty;
         } else if (module.builtinModules.includes(specifierText)) {
            if (isImport(node)) {
               newInfo = {
                  ...VisitorInfoM.empty,
                  esmImports: [node]
               };
            } else if (isExport(node)) {
               newInfo = {
                  ...VisitorInfoM.empty,
                  esmExports: [node]
               };
            }
         } else {
            const packageJSON = getPackageJSON(node, config.relativeProjectRoot);
            if (packageJSON) {
               if (isESModule(packageJSON) || isConditionalModule(packageJSON)) {
                  // Imported or exported path is in an ESM package, so only create a valid ESM specifier
                  newInfo = isImport(node)
                     ? {
                          ...VisitorInfoM.empty,
                          esmImports: [
                             ts.createImportDeclaration(
                                node.decorators,
                                node.modifiers,
                                node.importClause,
                                createValidESMPath(node, sourceFile, config, packageJSON)
                             )
                          ]
                       }
                     : isExport(node)
                     ? {
                          ...VisitorInfoM.empty,
                          esmExports: [
                             ts.createExportDeclaration(
                                node.decorators,
                                node.modifiers,
                                node.exportClause,
                                createValidESMPath(node, sourceFile, config, packageJSON)
                             )
                          ]
                       }
                     : VisitorInfoM.empty;
               } else {
                  // commonjs, builtin, or no package
                  if (isImport(node)) {
                     if (isNamedImport(node) && isDefaultImport(node)) {
                        // import A, { a, b } from "..."
                        newInfo = {
                           ...VisitorInfoM.empty,
                           destructureRequires: [createDestructureStatementForImport(node)],
                           esmImports: [
                              createDefaultImport(
                                 node,
                                 createValidESMPath(node, sourceFile, config, packageJSON)
                              )
                           ]
                        };
                     } else if (isNamedImport(node)) {
                        // import { A } from "..."
                        newInfo = {
                           ...VisitorInfoM.empty,
                           requires: [createRequireStatementForImport(node, config.prefix)],
                           shouldCreateRequire: true
                        };
                     } else if (isNamespaceImport(node)) {
                        // import * as A from "..."
                        newInfo = {
                           ...VisitorInfoM.empty,
                           esmImports: [
                              createDefaultImportForNamespaceImport(
                                 node,
                                 createValidESMPath(node, sourceFile, config, packageJSON)
                              )
                           ]
                        };
                     } else if (isDefaultImport(node)) {
                        // import A from "..."
                        newInfo = {
                           ...VisitorInfoM.empty,
                           esmImports: [
                              createDefaultImport(
                                 node,
                                 createValidESMPath(node, sourceFile, config, packageJSON)
                              )
                           ]
                        };
                     }
                  } else if (isExport(node)) {
                     if (isNamedExport(node)) {
                        // export { a, b } from "..."
                        newInfo = {
                           ...VisitorInfoM.empty,
                           esmExports: [
                              createExportDeclarationForNamedRequires(node, config.prefix)
                           ],
                           requires: [createRequireStatementForExport(node, config.prefix)],
                           shouldCreateRequire: true
                        };
                     } else if (isNamespaceExport(node)) {
                        // export * as A from "..."
                        newInfo = {
                           ...VisitorInfoM.empty,
                           esmExports: [createNamedExportsForDefaultImport(node, config.prefix)],
                           esmImports: [
                              createDefaultImportForNamespaceExport(
                                 node,
                                 createValidESMPath(node, sourceFile, config),
                                 config.prefix
                              )
                           ]
                        };
                     } else {
                        // export * from "..."
                        throw new Error(
                           `Cannot currently export * from 'cjs-module' @ ${
                              sourceFile.fileName
                           } : ${node.getText()}`
                        );
                     }
                  }
               }
            }
            /*
             * newInfo = F.pipe(
             *    getPackageJSON(node, config.relativeProjectRoot),
             *    E.map((packageJSON) => {
             *       if (isESModule(packageJSON) || isConditionalModule(packageJSON)) {
             *          return isImport(node)
             *             ? {
             *                  ...VisitorInfoM.empty,
             *                  esmImports: [
             *                     ts.createImportDeclaration(
             *                        node.decorators,
             *                        node.modifiers,
             *                        node.importClause,
             *                        createValidESMPath(node, sourceFile, config, packageJSON)
             *                     )
             *                  ]
             *               }
             *             : isExport(node)
             *             ? {
             *                  ...VisitorInfoM.empty,
             *                  esmExports: [
             *                     ts.createExportDeclaration(
             *                        node.decorators,
             *                        node.modifiers,
             *                        node.exportClause,
             *                        createValidESMPath(node, sourceFile, config, packageJSON)
             *                     )
             *                  ]
             *               }
             *             : VisitorInfoM.empty;
             *       } else {
             *          if (isImport(node)) {
             *             if (isNamedImport(node) && isDefaultImport(node)) {
             *                return {
             *                   ...VisitorInfoM.empty,
             *                   destructureRequires: [createDestructureStatementForImport(node)],
             *                   esmImports: [
             *                      createDefaultImport(
             *                         node,
             *                         createValidESMPath(node, sourceFile, config, packageJSON)
             *                      )
             *                   ]
             *                };
             *             } else if (isNamedImport(node)) {
             *                return {
             *                   ...VisitorInfoM.empty,
             *                   requires: [createRequireStatementForImport(node, config.prefix)],
             *                   shouldCreateRequire: true
             *                };
             *             } else if (isNamespaceImport(node)) {
             *                return {
             *                   ...VisitorInfoM.empty,
             *                   esmImports: [
             *                      createDefaultImportForNamespaceImport(
             *                         node,
             *                         createValidESMPath(node, sourceFile, config, packageJSON)
             *                      )
             *                   ]
             *                };
             *             } else if (isDefaultImport(node)) {
             *                return {
             *                   ...VisitorInfoM.empty,
             *                   esmImports: [
             *                      createDefaultImport(
             *                         node,
             *                         createValidESMPath(node, sourceFile, config, packageJSON)
             *                      )
             *                   ]
             *                };
             *             }
             *          } else if (isExport(node)) {
             *             if (isNamedExport(node)) {
             *                return {
             *                   ...VisitorInfoM.empty,
             *                   esmExports: [
             *                      createExportDeclarationForNamedRequires(node, config.prefix)
             *                   ],
             *                   requires: [createRequireStatementForExport(node, config.prefix)],
             *                   shouldCreateRequire: true
             *                };
             *             } else if (isNamespaceExport(node)) {
             *                return {
             *                   ...VisitorInfoM.empty,
             *                   esmExports: [createNamedExportsForDefaultImport(node, config.prefix)],
             *                   esmImports: [
             *                      createDefaultImportForNamespaceExport(
             *                         node,
             *                         createValidESMPath(node, sourceFile, config),
             *                         config.prefix
             *                      )
             *                   ]
             *                };
             *             } else {
             *                throw new Error(
             *                   `Cannot currently export * from 'cjs-module' @ ${
             *                      sourceFile.fileName
             *                   } : ${node.getText()}`
             *                );
             *             }
             *          }
             *          return VisitorInfoM.empty;
             *       }
             *    }),
             *    E.mapLeft(() => {
             *       if (isImport(node)) {
             *          if (module.builtinModules.includes(specifierText)) {
             *             return {
             *                ...VisitorInfoM.empty,
             *                esmImports: [node]
             *             };
             *          }
             *       } else if (isExport(node)) {
             *          if (module.builtinModules.includes(specifierText)) {
             *             return {
             *                ...VisitorInfoM.empty,
             *                esmExports: [node]
             *             };
             *          }
             *       }
             *       return VisitorInfoM.empty;
             *    }),
             *    E.fold(F.identity, F.identity)
             * );
             */
         }
         info.shouldCreateRequire = info.shouldCreateRequire || newInfo.shouldCreateRequire;
         info.esmExports = info.esmExports.concat(...newInfo.esmExports);
         info.esmImports = info.esmImports.concat(...newInfo.esmImports);
         info.requires = info.requires.concat(...newInfo.requires);
         return undefined;
      } else {
         return ts.visitEachChild(node, visitor(info), ctx);
      }
   };
   const visitedSourceFile = ts.visitEachChild(sourceFile, visitor(visitorInfo), ctx);
   return {
      info: visitorInfo,
      visitedSourceFile
   };
};
