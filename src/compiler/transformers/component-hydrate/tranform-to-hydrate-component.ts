import * as d from '@declarations';
import { addNativeImports } from '../component-native/native-imports';
import { catchError, loadTypeScriptDiagnostics } from '@utils';
import { ModuleKind, getBuildScriptTarget, getComponentMeta } from '../transform-utils';
import { updateHydrateComponentClass } from './hydrate-component';
import ts from 'typescript';

export function transformToHydrateComponentText(compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, build: d.Build, cmp: d.ComponentCompilerMeta, inputJsText: string) {
  if (buildCtx.shouldAbort) {
    return null;
  }

  let outputText: string = null;

  try {
    const transpileOpts: ts.TranspileOptions = {
      compilerOptions: {
        module: ModuleKind,
        target: getBuildScriptTarget(build)
      },
      fileName: cmp.jsFilePath,
      transformers: {
        after: [
          hydrateComponentTransform(compilerCtx, build)
        ]
      }
    };

    const transpileOutput = ts.transpileModule(inputJsText, transpileOpts);

    loadTypeScriptDiagnostics(buildCtx.diagnostics, transpileOutput.diagnostics);

    if (!buildCtx.hasError && typeof transpileOutput.outputText === 'string') {
      outputText = transpileOutput.outputText;
    }

  } catch (e) {
    catchError(buildCtx.diagnostics, e);
  }

  return outputText;
}


function hydrateComponentTransform(compilerCtx: d.CompilerCtx, build: d.Build): ts.TransformerFactory<ts.SourceFile> {

  return transformCtx => {

    return tsSourceFile => {
      function visitNode(node: ts.Node): any {
        if (ts.isClassDeclaration(node)) {
          const cmp = getComponentMeta(compilerCtx, tsSourceFile, node);
          if (cmp != null) {
            return updateHydrateComponentClass(node, cmp, build);
          }

        }

        return ts.visitEachChild(node, visitNode, transformCtx);
      }

      tsSourceFile = addNativeImports(transformCtx, tsSourceFile);
      return ts.visitEachChild(tsSourceFile, visitNode, transformCtx);
    };
  };
}
