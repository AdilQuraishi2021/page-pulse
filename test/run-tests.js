import { auditorTests } from "./auditor.test.js";
import { serverTests } from "./server.test.js";

const tests = [...auditorTests, ...serverTests];
let failures = 0;

for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

console.log(`${tests.length - failures}/${tests.length} tests passed`);

if (failures > 0) {
  process.exitCode = 1;
}
