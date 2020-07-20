import { env } from 'process';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);


export const compareNamedExports = (packageName, requiredPackage, importedPackage) => {
	const requiredNames = Object.keys(requiredPackage).filter(name => name !== 'default' && name !== '__esModule');
	const importedNames = Object.keys(importedPackage).filter(name => name !== 'default' && name !== '__esModule');
	const importedNamesSet = new Set(importedNames);
	const detectedNames = [];
	const missingNames = [];
	requiredNames.forEach(name => {
		if (importedNamesSet.has(name)) {
			detectedNames.push(name);
		} else {
			missingNames.push(name);
		}
	});

	let pass;
	if (missingNames.length === 0) {
		pass = true;
		if (env.NODE_DEBUG?.includes('test-packages')) {
			console.log(`${packageName}: All ${requiredNames.length} CommonJS named exports successfully detected`);
		}
	} else {
		pass = false;
		if (env.NODE_DEBUG?.includes('test-packages')) {
			console.log(`${packageName}: ${detectedNames.length} of ${requiredNames.length} (${Math.round(detectedNames.length / requiredNames.length * 100)}%) CommonJS named exports successfully detected. ${(detectedNames.length !== 0) ? 'Detected: ' + detectedNames.join(', ') + '. ' : ''}Missing: ${missingNames.join(', ')}`);
		}
	}
	return {
		pass,
		expectedNames: requiredNames,
		detectedNames,
		missingNames
	}
};


import * as importedPackage from 'REPLACE_WITH_PACKAGE_NAME';
export const runTest = () => {
	try {
		require.cache = Object.create(null); // Clear CommonJS cache
		const requiredPackage = require('REPLACE_WITH_PACKAGE_NAME');
		return compareNamedExports('REPLACE_WITH_PACKAGE_NAME', requiredPackage, importedPackage);
	} catch {
		return {
			pass: false,
			expectedNames: [],
			detectedNames: [],
			missingNames: []
		}
	}
}
