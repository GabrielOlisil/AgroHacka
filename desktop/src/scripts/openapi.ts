import fs from "node:fs";
import openapiTS, { astToString } from "openapi-typescript";

const openapiJsonUrl = "https://api.arikem.qzz.io/api/docs-json";


const ast = await openapiTS(new URL(openapiJsonUrl));
const contents = astToString(ast);

const reset = "\x1b[0m";
const verde = "\x1b[32m";

const fileRelativePath = './src/types/contract.d.ts';



fs.writeFileSync(fileRelativePath, contents);
console.log(`${verde}✔ Sucesso:${reset} O arquivo foi gravado. em ${verde} ${fileRelativePath} ${reset}`);