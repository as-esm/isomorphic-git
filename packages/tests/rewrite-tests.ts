import { type SourceFile, Project, Node, SyntaxKind, VariableDeclaration, CallExpression, VariableStatement, ExpressionStatement } from 'ts-morph';
import path from 'path';
import fs from 'fs';

// --- Configuration ---
const inputDir = './__tests__';
const outputDir = './packages/tests';
// ---------------------

async function main() {
  // Ensure the output directory exists and is clean
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir+"/__tests__", { recursive: true, force: true });
  }

  const project = new Project({
    //tsConfigFilePath: '../../tsconfig.json'
  });
  project.addSourceFilesAtPaths(`${inputDir}/**/*.js`);
  project.addSourceFilesAtPaths(`${inputDir}/**/*.cjs`);
  //project.addSourceFilesAtPaths(`./src/**/*`);

  console.log([...project.getSourceFiles().map(f => f.getFilePath().slice(process.cwd().length + 1))])
  console.log(`Found ${project.getSourceFiles().length} test files to process...`);

  for (const sourceFile of project.getSourceFiles()) {
    console.log(`Processing: ${sourceFile.getBaseName()}`);

    // --- Stage 1: Transform CommonJS exports to ESM exports ---
    transformModuleExports(sourceFile);
    transformDefaultExport(sourceFile);

    // --- Stage 2: Handle shebang if present ---
    const fullText = sourceFile.getFullText();
    const shebangRegex = /^(#!.*(\r\n?|\n))/;
    const shebangMatch = fullText.match(shebangRegex);
    let shebang = '';
    if (shebangMatch) {
      shebang = shebangMatch[0];
      console.log(`  -> Preserving shebang: ${shebang.trim()}`);
      sourceFile.replaceText([0, shebang.length], '');
    }

    // --- Stage 3: Transform top-level require() calls to ESM imports ---
    const requireDeclarations: (VariableDeclaration | CallExpression)[] = [];
    for (const statement of sourceFile.getStatements()) {
      if (Node.isVariableStatement(statement)) {
        for (const declaration of statement.getDeclarations()) {
          const initializer = declaration.getInitializer();
          if (initializer && Node.isCallExpression(initializer) && initializer.getExpression().getText() === 'require') {
            const argument = initializer.getArguments()[0];
            if (argument && Node.isStringLiteral(argument)) {
              requireDeclarations.push(declaration);
            }
          }
        }
      } else if (Node.isExpressionStatement(statement)) {
        const expression = statement.getExpression();
        if (Node.isCallExpression(expression) && expression.getExpression().getText() === 'require') {
          const argument = expression.getArguments()[0];
          if (argument && Node.isStringLiteral(argument)) {
            requireDeclarations.push(expression);
          }
        }
      }
    }

    // Process require transformations (backwards to avoid messing up AST positions)
    for (const declaration of requireDeclarations.reverse()) {
      if (Node.isCallExpression(declaration)) {
        const moduleSpecifierArg = declaration.getArguments()[0] as any;
        sourceFile.addImportDeclaration({ moduleSpecifier: moduleSpecifierArg.getLiteralValue() });
        // @ts-expect-error Generic Node type has no remove but DeclarationNodes do have one
        declaration.getParent()?.remove();
        continue;
      }
      const requireCall = declaration.getInitializerOrThrow() as CallExpression;
      const moduleSpecifier = (requireCall.getArguments()[0] as any).getLiteralValue();
      const nameNode = declaration.getNameNode();
      if (Node.isObjectBindingPattern(nameNode)) {
        const elements = nameNode.getElements().map(e => {
          const propertyName = e.getPropertyNameNode()?.getText();
          const name = e.getName();
          return propertyName ? `${propertyName} as ${name}` : name;
        });
        sourceFile.addImportDeclaration({ namedImports: elements, moduleSpecifier });
      } else if (Node.isIdentifier(nameNode)) {
        const identifier = nameNode.getText();
        sourceFile.addImportDeclaration({ defaultImport: identifier, moduleSpecifier });
      }
      declaration.getAncestors().find(a => Node.isVariableStatement(a))?.remove();
    }

    // --- Stage 4 (NEW): Ensure all relative imports have a .js extension ---
    ensureRelativeImportExtensions(sourceFile);

    // --- Stage 5 (NEW): Prepare output path, renaming .cjs to .js ---
    const relativePath = sourceFile.getFilePath().slice(process.cwd().length + 1);
    let outPathFile = path.join(outputDir, relativePath);

    if (outPathFile.endsWith('.cjs')) {
      outPathFile = outPathFile.slice(0, -4) + '.js';
      console.log(`  -> Renaming output to: ${path.basename(outPathFile)}`);
    }

    const outPathDir = path.dirname(outPathFile);
    fs.mkdirSync(outPathDir, { recursive: true });

    // Prepend shebang and save the final file
    const finalContent = shebang + sourceFile.getFullText();
    fs.writeFileSync(outPathFile, finalContent);
  }

  console.log(`\n✅ Successfully rewrote ${project.getSourceFiles().length} files to the '${outputDir}' directory.`);
}

/**
 * NEW: Iterates all import declarations and ensures relative paths end with '.js'.
 * It also converts any existing '.cjs' extensions in paths to '.js'.
 * @param {SourceFile} sourceFile
 */
function ensureRelativeImportExtensions(sourceFile: SourceFile) {
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    let specifier = importDeclaration.getModuleSpecifierValue();

    // Check if it's a relative path
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      // Correct .cjs to .js
      if (specifier.endsWith('.cjs')) {
        specifier = specifier.slice(0, -4) + '.js';
        importDeclaration.setModuleSpecifier(specifier);
        console.log(`  -> Corrected import path from .cjs to .js: ${specifier}`);
      }
      // Add extension if it's missing
      else if (!path.extname(specifier)) {
        specifier += '.js';
        importDeclaration.setModuleSpecifier(specifier);
        console.log(`  -> Added .js extension to import path: ${specifier}`);
      }
    }
  }
}

function transformDefaultExport(sourceFile: SourceFile) {
  const statements = sourceFile.getStatements();
  for (let i = statements.length - 1; i >= 0; i--) {
    const statement = statements[i];
    if (Node.isExpressionStatement(statement)) {
      const expression = statement.getExpression();
      if (Node.isBinaryExpression(expression) && expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
        const leftSide = expression.getLeft();
        if (leftSide.getText() === 'module.exports') {
          console.log(`  -> Found and transforming default export.`);
          const rightSide = expression.getRight();
          statement.replaceWithText(`export default ${rightSide.getText()};`);
          break;
        }
      }
    }
  }
}

function transformModuleExports(sourceFile: SourceFile) {
  const statements = sourceFile.getStatements();
  for (let i = statements.length - 1; i >= 0; i--) {
    const statement = statements[i];
    if (Node.isExpressionStatement(statement)) {
      const expression = statement.getExpression();
      if (Node.isBinaryExpression(expression) && expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
        const leftSide = expression.getLeft();
        if (Node.isPropertyAccessExpression(leftSide)) {
          const objectText = leftSide.getExpression().getText();
          if (objectText === 'module.exports' || objectText === 'exports') {
            const propertyName = leftSide.getName();
            const rightSide = expression.getRight();
            console.log(`  -> Found and transforming named export for: "${propertyName}"`);
            statement.replaceWithText(`export const ${propertyName} = ${rightSide.getText()};`);
          }
        }
      }
    }
  }
}

main().catch(console.error);