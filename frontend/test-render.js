import fs from 'fs';
import path from 'path';

// We just want to check if the code can be evaluated without syntax errors.
// Wait, we can't easily mock everything for a full SSR render in a simple script.
console.log("Checking React...");
