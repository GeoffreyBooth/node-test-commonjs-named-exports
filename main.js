import { promises as fs, constants as fsConstants } from 'fs';
const { mkdir, readFile, open, writeFile } = fs;

import { promisify } from 'util';
import { execFile as execFileCallback } from 'child_process';
const execFile = promisify(execFileCallback);

import { get } from 'https';
import { chdir, cwd, execPath, stdout as processStdout } from 'process';


// Leave out packages that can't build under macOS or print warnings on requiring
const excludePackages = new Set([
	'101',
	'after',
	'autoprefixer-core',
	'bufferstream',
	'buffertools',
	'config',
	'download',
	'ffi',
	'fibers',
	'forever',
	'fstream',
	'hiredis',
	'i2c',
	'istanbul',
	'mraa',
	'nan',
	'nib',
	'npmconf',
	'pg',
	'prompt',
	'pty.js',
	'ref',
	'stylus',
	'windows.foundation',
	'windows.storage',
	'windows.storage.streams',
	'zmq',
]);


const getTopNpmPackages = async (count = 1000) => {
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
	const packagesToTest = [];
	for (let i = 0, len = packages.length; i < len; i++) {
		const name = packages[i];
		if (excludePackages.has(name)) {
			continue;
		} else if (installedPackages[name]) {
			packagesToTest.push(name);
			continue;
		}
		try {
			processStdout.clearLine();
			processStdout.cursorTo(0);
			processStdout.write(`Installing package: ${name}`)
			await execFile('npm', ['install', name], {cwd: `${cwd()}/test-app`});
			packagesToTest.push(name);
		} catch (error) {
			console.error(`Error installing ${name}:`, error);
		}
	}
	processStdout.clearLine();
	processStdout.cursorTo(0);
	return packagesToTest;
}


const testPackages = async (installedPackages) => {
	const results = {
		passedPackages: [],
		failedPackages: [],
		passedPackagesCount: 0,
		failedPackagesCount: 0,
		expectedNamesCount: 0,
		detectedNamesCount: 0,
	};

	const testScript = await readFile('./test.js', 'utf8');
	for (let i = 0, len = installedPackages.length; i < len; i++) {
		const name = installedPackages[i];
		const js = testScript.replace(/REPLACE_WITH_PACKAGE_NAME/g, name);
		await writeFile('./test-app/run-test.js', js);
		// console.log(`------ ${name}`);
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
		if (result.pass) {
			results.passedPackages.push(name);
			results.passedPackagesCount++;
		} else {
			results.failedPackages.push(name);
			results.failedPackagesCount++;
		}
		results.expectedNamesCount += result.expectedNames.length;
		results.detectedNamesCount += result.detectedNames.length;
	}
	processStdout.clearLine();
	processStdout.cursorTo(0);

	return results;
}


const processResults = async (results) => {
	await writeFile('./results.json', JSON.stringify(results, null, '\t')).catch(console.error);
	const { passedPackages, failedPackages, passedPackagesCount, failedPackagesCount, expectedNamesCount, detectedNamesCount } = results;
	console.log(`${passedPackagesCount} of ${passedPackagesCount + failedPackagesCount} packages (${Math.round((passedPackagesCount / (passedPackagesCount + failedPackagesCount)) * 100)}%) had all CommonJS named exports detected successfully.`);
	console.log(`${detectedNamesCount} of ${detectedNamesCount + expectedNamesCount} CommonJS named exports (${Math.round(detectedNamesCount / (detectedNamesCount + expectedNamesCount) * 100)}%) were detected successfully.`);
	console.log(`\nSuccessfully detected packages:\n- ${passedPackages.join('\n- ')}`);
	console.log(`\nUnsuccessfully detected packages:\n- ${failedPackages.join('\n- ')}`);
}


// Main entry point
(async () => {
	console.log('Testing CommonJS named exports detection for top 1000 packages...');
	// Get top 1000 packages’ names
	const topNpmPackages = await getTopNpmPackages(1000);

	// Create a test app and install those packages
	const packagesToTest = await installPackages(topNpmPackages);

	// Test detection of CommonJS named exports by generating a JavaScript file and evaluating it
	const results = await testPackages(packagesToTest);

	await processResults(results);
})();
