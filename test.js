import { env } from 'process';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);


export const compareNamedExports = (packageName, requiredPackage, importedPackage) => {
	const transpiled = requiredPackage.__esModule || requiredPackage['default']?.__esModule; // Truthy, not just present

	const getNames = (obj) => {
		const names = new Set();
		while (obj) {
			Object.keys(obj).forEach(name => {
				if (name !== 'default' && name !== '__esModule') {
					try {
						// Some exported names throw on access, e.g. if deprecated
						names.add(name);
					} catch {}
				}
			});
			obj = Object.getPrototypeOf(obj);
		}
		return names;
	}

	const requiredNames = getNames(requiredPackage);
	const importedNames = getNames(importedPackage);
	const detectedNames = [];
	const missingNames = [];
	requiredNames.forEach(name => {
		if (importedNames.has(name)) {
			detectedNames.push(name);
		} else {
			missingNames.push(name);
		}
	});

	console.log(JSON.stringify({
		name: packageName,
		transpiled,
		expectedNames: [...requiredNames],
		detectedNames,
		missingNames
	}));
};


import * as importedPackage from 'REPLACE_WITH_PACKAGE_NAME';

// Main entry point
(async () => {
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
})();
