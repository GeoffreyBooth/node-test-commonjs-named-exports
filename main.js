import { promises as fs, constants as fsConstants } from 'fs';
const { stat, mkdir, readFile, open, writeFile } = fs;

import { dirname, join } from 'path';
import { promisify } from 'util';
import { execFile as execFileCallback } from 'child_process';
const execFile = promisify(execFileCallback);

import { get } from 'https';
import { argv, chdir, cwd, execPath, stdout as processStdout, exit } from 'process';

import Module, { createRequire } from 'module';
const originalModuleLoad = Module.prototype.load;
const originalModuleCompile = Module.prototype._compile;
const require = createRequire(import.meta.url);
const originalRequireJs = require.extensions['.js'];


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


const installPackages = async (nodeBinary, count, packages) => {
	// Install packages in subfolders where each subfolder holds 200 packages
	// This is because after hundreds of dependencies, `npm install` takes exponentially longer
	const packagesPerFolder = 200;
	let startIndex = 0;
	let installedPackagesToTest = [];

	while (startIndex < packages.length) {
		const endIndex = Math.min(count, startIndex + packagesPerFolder);
		processStdout.clearLine();
		processStdout.cursorTo(0);
		processStdout.write(`Installing packages ${startIndex}-${endIndex}...`)

		const packagesToInstall = packages.slice(startIndex, endIndex);
		const packageJson = {type: 'module', dependencies: {}};
		packagesToInstall.forEach(name => {
			packageJson.dependencies[name] = '*';
		});
		const packagesFolder = `packages/packages-${startIndex}-${endIndex}`;
		await mkdir(`./${packagesFolder}`, {recursive: true});

		let alreadyInstalled = true;
		try {
			const stats = await stat(`./${packagesFolder}/node_modules`);
		} catch {
			// node_modules folder already exists, no need to rerun installation
			alreadyInstalled = false;
		}

		if (!alreadyInstalled) {
			let handle;
			try {
				handle = await open(`./${packagesFolder}/package.json`, 'wx'); // Will throw if file already exists
				await handle.writeFile(JSON.stringify(packageJson, null, '  '));
			} catch {} finally {
				if (handle) {
					await handle.close();
				}
			}

			try {
				await execFile(nodeBinary, [join(dirname(nodeBinary), '../../deps/npm/bin/npm-cli.js'), 'install', '--force', '--ignore-scripts', '--no-optional', `--nodedir=${nodeBinary}`, '--only=prod', '--no-audit'], {cwd: `${cwd()}/${packagesFolder}`});
			} catch {
				// If installing all 200 at once fails, install each one individually
				for (let i = packagesToInstall.length - 1; i >= 0; i--) {
					try {
						await execFile(nodeBinary, [join(dirname(nodeBinary), '../../deps/npm/bin/npm-cli.js'), 'install', packagesToInstall[i], '--force', '--ignore-scripts', '--no-optional', `--nodedir=${nodeBinary}`, '--only=prod', '--no-audit'], {cwd: `${cwd()}/${packagesFolder}`});
					} catch {}
				}
			}
		}

		const installedPackageJson = JSON.parse(await readFile(`./${packagesFolder}/package.json`, 'utf8'));
		const installedPackages = Object.keys({ ...installedPackageJson.dependencies, ...installedPackageJson.devDependencies }).map(name => { return {name, folder: packagesFolder}});
		installedPackagesToTest = [...installedPackagesToTest, ...installedPackages];

		startIndex = startIndex + packagesPerFolder;
	}

	processStdout.clearLine();
	processStdout.cursorTo(0);
	return installedPackagesToTest;
}


const analyzePackages = async (packages) => {
	const packagesToTest = [];
	for (let i = 0, len = packages.length; i < len; i++) {
		const { name, folder } = packages[i];

		let readme;
		try {
			readme = await readFile(`./${folder}/node_modules/${name}/readme.md`, 'utf8');
		} catch {
			try {
				readme = await readFile(`./${folder}/node_modules/${name}/readme.markdown`, 'utf8');
			} catch {
				continue; // Exclude packages that have no readmes
			}
		}

		const readmeEncouragesNamedExports =
			new RegExp(`import {.*} from ['"]${name}['"\`]`).test(readme) ||
			new RegExp(`{.*} = require\\(['"\`]${name}['"\`]`).test(readme);

		packagesToTest.push({name, folder, readmeEncouragesNamedExports});
	}
	return packagesToTest;
}


const testPackages = async (nodeBinary, packages) => {
	const results = [];
	const testScript = await readFile('./test.js', 'utf8');
	for (let i = 0, len = packages.length; i < len; i++) {
		const { name, folder, readmeEncouragesNamedExports } = packages[i];
		const js = testScript.replace(/REPLACE_WITH_PACKAGE_NAME/g, name);
		await writeFile(`./${folder}/run-test.js`, js);
		processStdout.clearLine();
		processStdout.cursorTo(0);
		processStdout.write(`Testing package ${i}: ${name}`);
		let result;
		try {
			const { stdout } = await execFile(nodeBinary, ['run-test.js'], {cwd: `${cwd()}/${folder}`, timeout: 10000});
			result = JSON.parse(stdout);
		} catch {
			continue; // Skip modules where the test can't generate output, usually because the package itself has thrown errors (it expects a browser environment, for example)
		}
		result.readmeEncouragesNamedExports = readmeEncouragesNamedExports;
		results.push(result);
		Module.prototype.load = originalModuleLoad;
		Module.prototype._compile = originalModuleCompile;
		require.extensions['.js'] = originalRequireJs;
	}
	processStdout.clearLine();
	processStdout.cursorTo(0);
	await writeFile('./results.json', JSON.stringify(results, null, '\t')).catch(console.error);
	return results;
}


const reportResults = (allResults) => {
	const generateReport = (results) => {
		const report = {
			count: 0,
			defaultOnly: 0,
			allDetected: 0,
			someDetected: 0,
			noneDetected: 0,
		}
		results.forEach(({ expectedNames, detectedNames }) => {
			report.count++;
			if (expectedNames.length === 0) {
				report.defaultOnly++;
			} else if (expectedNames.length <= detectedNames.length) {
				report.allDetected++;
			} else if (expectedNames.length !== 0 && detectedNames.length !== 0) {
				report.someDetected++;
			} else if (expectedNames.length !== 0 && detectedNames.length === 0) {
				report.noneDetected++;
			}
		});
		return report;
	}

	const percentage = (numerator, denominator) => `${Math.round(numerator / denominator * 100)}% (${numerator.toLocaleString()} of ${denominator.toLocaleString()})`;

	const printReport = (report) => {
		console.log(`  - ${percentage(report.defaultOnly + report.allDetected, report.count)} packages had either only a default export in CommonJS and therefore also in ESM (${report.defaultOnly} packages) or all named exports detected in CommonJS were also detected in ESM (${report.allDetected} packages).`);
		console.log(`  - ${percentage(report.someDetected + report.noneDetected, report.count)} packages had either some but not all CommonJS exports detected in ESM (${report.someDetected} packages) or no CommonJS exports detected in ESM (${report.noneDetected} packages).`);
	}

	const mainReport = generateReport(allResults);
	console.log(`\nOf all ${mainReport.count.toLocaleString()} packages installed and tested:\n`);
	printReport(mainReport);

	const readmeReport = generateReport(allResults.filter(result => result.readmeEncouragesNamedExports));
	console.log(`\nOf ${readmeReport.count.toLocaleString()} packages that had a readme encouraging the use of named exports:\n`);
	printReport(readmeReport);

	const transpiledReport = generateReport(allResults.filter(result => result.transpiled))
	console.log(`\nOf ${transpiledReport.count.toLocaleString()} packages generated via transpilation:\n`);
	printReport(transpiledReport);
}


// Main entry point
(async () => {
	const [nodeBinary, , count = 3000] = argv;
	console.log(`Testing CommonJS named exports detection for top ${count} packages...`);

	// Get top packages’ names
	const topNpmPackages = await getTopNpmPackages(count);

	// Create a test app and install those packages
	const installedPackages = await installPackages(nodeBinary, count, topNpmPackages);

	// Analyze packages to determine which ones we should expect named exports from
	const packagesToTest = await analyzePackages(installedPackages);

	// Test detection of CommonJS named exports by generating a JavaScript file and evaluating it
	const results = await testPackages(nodeBinary, packagesToTest.slice(10));

	// Analyze results and print totals
	reportResults(results);
	exit();
})();
