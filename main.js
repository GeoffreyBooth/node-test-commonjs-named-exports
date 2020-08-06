import { promises as fs, constants as fsConstants } from 'fs';
const { mkdir, readFile, open, writeFile } = fs;

import { promisify } from 'util';
import { execFile as execFileCallback } from 'child_process';
const execFile = promisify(execFileCallback);

import { get } from 'https';
import { chdir, cwd, execPath, stdout as processStdout, exit } from 'process';


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
		'anima-yocto-event',
		'anima-yocto-lite',
		'artusi-kitchen-tools',
		'autoprefixer-core',
		'ava',
		'azure',
		'babel-loader',
		'base64',
		'bigint',
		'bin-build',
		'bitcore',
		'blob',
		'bluetooth-hci-socket',
		'browserstacktunnel-wrapper',
		'bufferstream',
		'buffertools',
		'cliff',
		'config',
		'cordova',
		'decompress',
		'download',
		'electron-download',
		'ember',
		'epoll',
		'exec-sync',
		'fairmont',
		'ffi',
		'fibers',
		'firmata',
		'fis-parser-less',
		'forever',
		'fstream',
		'fstream-ignore',
		'gcloud',
		'gulp-stylus',
		'hiredis',
		'i2c',
		'inotify',
		'insight',
		'iotdb',
		'istanbul',
		'kexec',
		'kue',
		'lame',
		'lint',
		'lwip',
		'mapnik',
		'mariasql',
		'material-ui',
		'memwatch',
		'mraa',
		'nan',
		'newrelic',
		'nib',
		'node-fibers',
		'node-icu-charset-detector',
		'node-inspector',
		'node-protobuf',
		'node-proxy',
		'node-syslog',
		'node-telegram-bot-api',
		'nodegit',
		'NodObjC',
		'npmconf',
		'onoff',
		'opencv',
		'parse',
		'pg',
		'player',
		'prompt',
		'pty.js',
		'react-addons-test-utils',
		'ref',
		'ref-struct',
		'sharp',
		'soupselect',
		'streamline-runtime',
		'stylus',
		'sync',
		'tar-pack',
		'tar.gz',
		'tarball-extract',
		'time',
		'ursa',
		'usage',
		'usb',
		'v8-profiler',
		'weak',
		'windows.foundation',
		'windows.storage',
		'windows.storage.fileproperties',
		'windows.storage.provider',
		'windows.storage.search',
		'windows.storage.streams',
		'x-log',
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

		const readmeEncouragesNamedExports =
			new RegExp(`import {.*} from ['"]${name}['"\`]`).test(readme) ||
			new RegExp(`{.*} = require\\(['"\`]${name}['"\`]`).test(readme);

		packagesToTest.push({name, readmeEncouragesNamedExports});
	}
	return packagesToTest;
}


const testPackages = async (packages) => {
	const results = [];
	const testScript = await readFile('./test.js', 'utf8');
	for (let i = 0, len = packages.length; i < len; i++) {
		const { name, readmeEncouragesNamedExports } = packages[i];
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
		result.readmeEncouragesNamedExports = readmeEncouragesNamedExports;
		results.push(result);
	}
	processStdout.clearLine();
	processStdout.cursorTo(0);
	await writeFile('./results.json', JSON.stringify(results, null, '\t')).catch(console.error);
	return results;
}


const reportResults = (results) => {
	const testedCount = results.length;

	// First run through all packages and determine if each one passes or fails per our criteria
	const report = {
		passes: {
			count: 0,
			defaultOnly: 0,
			allDetected: 0,
			readmeEncouragedNamedExportsAndSomeDetected: 0,
			readmeDidntEncourageNamedExportsAndSomeDetected: 0,
			readmeDidntEncourageNamedExportsAndNoneDetected: 0,
		},
		failures: {
			count: 0,
			readmeEncouragedNamedExportsButNoneDetected: 0,
		}
	}
	results.forEach(({ expectedNames, detectedNames, readmeEncouragesNamedExports }) => {
		if (expectedNames.length === 0) {
			report.passes.count++;
			report.passes.defaultOnly++;
		} else if (expectedNames.length === detectedNames.length) {
			report.passes.count++;
			report.passes.allDetected++;
		} else if (readmeEncouragesNamedExports) {
			if (detectedNames.length !== 0) {
				report.passes.count++;
				report.passes.readmeEncouragedNamedExportsAndSomeDetected++;
			} else {
				report.failures.count++;
				report.failures.readmeEncouragedNamedExportsButNoneDetected++;
			}
		} else {
			if (detectedNames.length !== 0) {
				report.passes.count++;
				report.passes.readmeDidntEncourageNamedExportsAndSomeDetected++;
			} else {
				report.passes.count++;
				report.passes.readmeDidntEncourageNamedExportsAndNoneDetected++;
			}
		}
	});

	const percentage = (numerator, denominator) => `${Math.round(numerator / denominator * 100)}% (${numerator.toLocaleString()} of ${denominator.toLocaleString()})`;
	console.log(`Of ${testedCount.toLocaleString()} packages installed and tested:`);

	console.log(`\n- ${percentage(report.passes.count, testedCount)} passed based on one or more of the following criteria:`);
	console.log(`  - ${percentage(report.passes.defaultOnly, testedCount)} packages had only a default export in CommonJS.`);
	console.log(`  - ${percentage(report.passes.allDetected, testedCount)} packages had the same number of named exports detected in CommonJS and in ESM.`);
	console.log(`  - ${percentage(report.passes.readmeEncouragedNamedExportsAndSomeDetected, testedCount)} packages had a readme encouraging the use of named exports and some were detected.`);
	console.log(`  - ${percentage(report.passes.readmeDidntEncourageNamedExportsAndSomeDetected, testedCount)} packages didn’t encourage the use of named exports and some were detected.`);
	console.log(`  - ${percentage(report.passes.readmeDidntEncourageNamedExportsAndNoneDetected, testedCount)} packages didn’t encourage the use of named exports and none were detected.`);

	console.log(`\n- ${percentage(report.failures.count, testedCount)} failed based on one or more of the following criteria:`);
	console.log(`  - ${percentage(report.failures.readmeEncouragedNamedExportsButNoneDetected, testedCount)} packages had readmes encouraging the use of named exports but none were found.`);

	const transpiledPackages = results.filter(result => result.transpiled);
	const transpiledPackagesCount = transpiledPackages.length;
	const transpiledReport = {
		defaultOnly: 0,
		allDetected: 0,
		someDetected: 0,
		noneDetected: 0,
	};
	transpiledPackages.forEach(({ expectedNames, detectedNames }) => {
		if (expectedNames.length === 0) {
			transpiledReport.defaultOnly++;
		} else if (expectedNames.length === detectedNames.length) {
			transpiledReport.allDetected++;
		} else if (detectedNames.length !== 0) {
			transpiledReport.someDetected++;
		} else {
			transpiledReport.noneDetected++;
		}
	});
	console.log(`\nOf the subset of ${transpiledPackagesCount.toLocaleString()} packages generated via transpilation:\n`);
	console.log(`  - ${percentage(transpiledReport.defaultOnly, transpiledPackagesCount)} packages had only a default export in CommonJS.`);
	console.log(`  - ${percentage(transpiledReport.allDetected, transpiledPackagesCount)} packages had the same number of named exports detected in CommonJS and in ESM.`);
	console.log(`  - ${percentage(transpiledReport.someDetected, transpiledPackagesCount)} packages had some but not all CommonJS named exports detected in ESM.`);
	console.log(`  - ${percentage(transpiledReport.noneDetected, transpiledPackagesCount)} packages had no CommonJS named exports detected in ESM.`);
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

	// Analyze results and print totals
	reportResults(results);
	exit();
})();
