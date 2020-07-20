import { promises as fs, constants as fsConstants } from 'fs';
const { mkdir, readFile, open, writeFile } = fs;

import { promisify } from 'util';
import { execFile as execFileCallback } from 'child_process';
const execFile = promisify(execFileCallback);

import { get } from 'https';
import { chdir, cwd, execPath, stdout as processStdout } from 'process';


const excludePackages = new Set([
	// Ignore the Node builtins; https://github.com/sindresorhus/builtin-modules/blob/master/builtin-modules.json
	...[
		'assert',
		'async_hooks',
		'buffer',
		'child_process',
		'cluster',
		'console',
		'constants',
		'crypto',
		'dgram',
		'dns',
		'domain',
		'events',
		'fs',
		'http',
		'http2',
		'https',
		'inspector',
		'module',
		'net',
		'os',
		'path',
		'perf_hooks',
		'process',
		'punycode',
		'querystring',
		'readline',
		'repl',
		'stream',
		'string_decoder',
		'timers',
		'tls',
		'trace_events',
		'tty',
		'url',
		'util',
		'v8',
		'vm',
		'zlib'
	],
	// And leave out packages that can’t build under macOS or print warnings on requiring
	...[
		'101',
		'after',
		'artusi-kitchen-tools',
		'autoprefixer-core',
		'base64',
		'bigint',
		'bitcore',
		'bluetooth-hci-socket',
		'bufferstream',
		'buffertools',
		'config',
		'download',
		'exec-sync',
		'ffi',
		'fibers',
		'forever',
		'fstream',
		'gcloud',
		'hiredis',
		'i2c',
		'inotify',
		'istanbul',
		'kexec',
		'lame',
		'lwip',
		'mariasql',
		'mapnik',
		'memwatch',
		'mraa',
		'nan',
		'nib',
		'node-icu-charset-detector',
		'node-inspector',
		'node-protobuf',
		'node-proxy',
		'node-syslog',
		'NodObjC',
		'npmconf',
		'opencv',
		'pg',
		'player',
		'prompt',
		'pty.js',
		'ref',
		'ref-struct',
		'stylus',
		'time',
		'ursa',
		'usage',
		'v8-profiler',
		'weak',
		'windows.foundation',
		'windows.storage',
		'windows.storage.fileproperties',
		'windows.storage.provider',
		'windows.storage.search',
		'windows.storage.streams',
		'xpc-connection',
		'xtuple-server-lib',
		'zmq',
	],
]);


const getTopNpmPackages = async (count) => {
	let npmRankDataRaw;
	try {
		npmRankDataRaw = await readFile('./.cache/npmrank.json', 'utf8');
	} catch {
		npmRankDataRaw = await (async () => {
			return new Promise((resolve, reject) => {
				get('https://anvaka.github.io/npmrank/online/npmrank.json', (response) => {
					response.setEncoding('utf8');
						let data = '';
						response.on('data', chunk => data += chunk);
						response.on('end', () => {
							// Cache this data for future runs of this script
							mkdir('./.cache', {recursive: true})
							.then(() => writeFile('./.cache/npmrank.json', data))
							.catch(console.error);
							resolve(data);
						});
				}).on('error', reject);
			})
		})();
	}
	const npmRankDataJson = JSON.parse(npmRankDataRaw);
	// Sort by popularity
	const npmRankDataSorted = Object.keys(npmRankDataJson.rank).sort((a, b) => parseFloat(npmRankDataJson.rank[b] - parseFloat(npmRankDataJson.rank[a])));
	// Return an array of package names, starting from most popular to however many were requested
	return npmRankDataSorted.slice(0, count);
}


const installPackages = async (packages) => {
	await mkdir('./test-app', {recursive: true});
	try {
		const fileDescriptor = await open('./test-app/package.json', 'wx'); // Will throw if file already exists
		await fileDescriptor.writeFile('{"type": "module", "dependencies": {}}');
	} catch {}
	const testPackageJson = JSON.parse(await readFile('./test-app/package.json', 'utf8'));
	const installedPackages = { ...testPackageJson.dependencies, ...testPackageJson.devDependencies };
	const installedPackagesToTest = [];
	for (let i = 0, len = packages.length; i < len; i++) {
		const name = packages[i];
		if (excludePackages.has(name)) {
			continue;
		} else if (installedPackages[name]) {
			installedPackagesToTest.push(name);
			continue;
		}
		try {
			processStdout.clearLine();
			processStdout.cursorTo(0);
			processStdout.write(`Installing package: ${name}`)
			await execFile('npm', ['install', name], {cwd: `${cwd()}/test-app`});
			installedPackagesToTest.push(name);
		} catch (error) {
			console.error(`Error installing ${name}:`, error);
		}
	}
	processStdout.clearLine();
	processStdout.cursorTo(0);
	return installedPackagesToTest;
}


const analyzePackages = async (packages) => {
	const packagesToTest = [];
	for (let i = 0, len = packages.length; i < len; i++) {
		const name = packages[i];

		let readme;
		try {
			readme = await readFile(`./test-app/node_modules/${name}/readme.md`, 'utf8');
		} catch {
			try {
				readme = await readFile(`./test-app/node_modules/${name}/readme.markdown`, 'utf8');
			} catch {
				continue; // Exclude packages that have no readmes
			}
		}

		if (new RegExp(`import {.*} from ['"]${name}['"\`]`).test(readme) ||
				new RegExp(`{.*} = require\\(['"\`]${name}['"\`]`).test(readme)) {
			packagesToTest.push(name);
		}
	}
	console.log(`\nFound ${packagesToTest.length} packages with readmes suggesting that users should use named exports.\n`);
	return packagesToTest;
}


const testPackages = async (packages) => {
	const results = {
		packagesWithOnlyDefaultCommonJSExport: [],
		packagesWithAllNamesDetected: [],
		packagesWithSomeNamesDetected: [],
		packagesWithNoNamesDetected: [],
	};

	const testScript = await readFile('./test.js', 'utf8');
	for (let i = 0, len = packages.length; i < len; i++) {
		const name = packages[i];
		const js = testScript.replace(/REPLACE_WITH_PACKAGE_NAME/g, name);
		await writeFile('./test-app/run-test.js', js);
		processStdout.clearLine();
		processStdout.cursorTo(0);
		processStdout.write(`Testing package: ${name}`)
		let test;
		try {
			test = await import(`./test-app/run-test.js?${i}`);
		} catch {
			continue; // Skip modules that fail to import, e.g. because they assume a browser environment
		}
		const result = test.runTest();
		if (result.expectedNames.length === 0) {
			results.packagesWithOnlyDefaultCommonJSExport.push(result);
		} else if (result.expectedNames.length === result.detectedNames.length) {
			results.packagesWithAllNamesDetected.push(result);
		} else if (result.detectedNames.length !== 0) {
			results.packagesWithSomeNamesDetected.push(result);
		} else {
			results.packagesWithNoNamesDetected.push(result);
		}
	}
	processStdout.clearLine();
	processStdout.cursorTo(0);

	return results;
}


const processResults = async (results) => {
	await writeFile('./results.json', JSON.stringify(results, null, '\t')).catch(console.error);
	const { packagesWithOnlyDefaultCommonJSExport, packagesWithAllNamesDetected, packagesWithSomeNamesDetected, packagesWithNoNamesDetected } = results;
	const allPackagesCount = packagesWithOnlyDefaultCommonJSExport.length + packagesWithAllNamesDetected.length + packagesWithSomeNamesDetected.length + packagesWithNoNamesDetected.length;

	if (packagesWithOnlyDefaultCommonJSExport.length !== 0) {
		console.log(`\n- ${Math.round(packagesWithOnlyDefaultCommonJSExport.length / allPackagesCount * 100)}% have only a default export, usable in both CommonJS and ESM.\n`);
	}
	console.log(`- ${Math.round(packagesWithAllNamesDetected.length / allPackagesCount * 100)}% had all CommonJS named exports detected.\n`);

	console.log(`- ${Math.round(packagesWithSomeNamesDetected.length / allPackagesCount * 100)}% had some CommonJS named exports detected.\n`);

	console.log(`- ${Math.round(packagesWithNoNamesDetected.length / allPackagesCount * 100)}% had no CommonJS named exports detected.\n`);
}


// Main entry point
(async (count = 3000) => {
	console.log(`Testing CommonJS named exports detection for top ${count} packages...`);
	// Get top packages’ names
	const topNpmPackages = await getTopNpmPackages(count);

	// Create a test app and install those packages
	const installedPackages = await installPackages(topNpmPackages);

	// Analyze packages to determine which ones we should expect named exports from
	const packagesToTest = await analyzePackages(installedPackages);

	// Test detection of CommonJS named exports by generating a JavaScript file and evaluating it
	const results = await testPackages(packagesToTest);

	await processResults(results);
})();
