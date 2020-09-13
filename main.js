import { promises as fs, constants as fsConstants } from 'fs';
const { mkdir, readFile, open, writeFile } = fs;

import { promisify } from 'util';
import { execFile as execFileCallback } from 'child_process';
const execFile = promisify(execFileCallback);

import { get } from 'https';
import { chdir, cwd, execPath, stdout as processStdout, exit } from 'process';

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
	// And leave out packages that can’t build under macOS or print warnings on requiring
	...[
		'101',
		'after',
		'aliyun-sdk',
		'amazeui',
		'amp-message',
		'ampersand-view',
		'angular',
		'angular-sanitize',
		'angular-translate',
		'angular-ui-router',
		'angulartics',
		'anima-yocto-core',
		'anima-yocto-event',
		'anima-yocto-lite',
		'apeman-proto-abstract',
		'apeman-react-style',
		'aping',
		'apn',
		'archiver-utils',
		'artusi-kitchen-tools',
		'autoprefixer-core',
		'ava',
		'awssum',
		'azure',
		'babel',
		'babel-cli',
		'babel-loader',
		'babel-plugin-transform-es2015-parameters',
		'babel-register',
		'base64',
		'baudio',
		'bean',
		'bigint',
		'bin-build',
		'bitcore',
		'blob',
		'bluetooth-hci-socket',
		'bonzo',
		'bookshelf',
		'bootstrap',
		'bosonic',
		'bourbon-neat',
		'browser-fingerprint',
		'browser-request',
		'browserify-middleware',
		'browserstacktunnel-wrapper',
		'bufferstream',
		'buffertools',
		'buffy',
		'caf_core',
		'cassandra-driver',
		'cfn-lambda',
		'cipher-base',
		'classie',
		'cliff',
		'closest',
		'cloudinary',
		'codecov.io',
		'codemirror',
		'component-builder',
		'component-raf',
		'config',
		'cordova',
		'cordova-lib',
		'couchr',
		'csv-parser',
		'csv-string',
		'csvtojson',
		'cucumber',
		'datauri',
		'ddp',
		'decompress',
		'derby',
		'desandro-matches-selector',
		'dnode',
		'dojo',
		'dom-events',
		'dom-matchesselector',
		'domready',
		'download',
		'edge',
		'edp-core',
		'electron-download',
		'email-templates',
		'ember',
		'ember-auth',
		'ember-template-compiler',
		'epoll',
		'errors',
		'es5-shim',
		'exec-sync',
		'execSync',
		'express.io',
		'fairmont',
		'fbjs',
		'fetch',
		'ffi',
		'fibers',
		'filed',
		'firebase',
		'firmata',
		'fis-parser-less',
		'fis3',
		'flushwritable',
		'forever',
		'fs-sync',
		'fstream',
		'fstream-ignore',
		'gcloud',
		'geoip-lite',
		'get-pixels',
		'get-size',
		'gherkin',
		'github',
		'global-modules',
		'good-squeeze',
		'gridfs-stream',
		'grunt',
		'gulp-browserify',
		'gulp-changed',
		'gulp-coffee',
		'gulp-eslint',
		'gulp-git',
		'gulp-header',
		'gulp-imagemin',
		'gulp-jade',
		'gulp-load-plugins',
		'gulp-stylus',
		'haml-coffee',
		'hammerjs',
		'highlight',
		'hiredis',
		'http-agent',
		'i2c',
		'iced-coffee-script',
		'iconv',
		'inline-process-browser',
		'inotify',
		'insight',
		'iotdb',
		'istanbul',
		'jayson',
		'jimp',
		'jquery',
		'jQuery',
		'jquery-browserify',
		'jquery-github',
		'jquery-ui',
		'jsforce',
		'jslint',
		'json2csv',
		'jspm',
		'kafka-node',
		'karma-phantomjs-launcher',
		'keep-alive-agent',
		'kexec',
		'kronos-step',
		'kue',
		'lame',
		'laravel-elixir',
		'latest',
		'ldjson-stream',
		'le_node',
		'leaflet',
		'line-input-stream',
		'linebreak',
		'lint',
		'localtunnel',
		'loopback-connector',
		'lwip',
		'lynx',
		'mailgun-js',
		'mapnik',
		'mariasql',
		'match-stream',
		'material-ui',
		'media',
		'memwatch',
		'meow',
		'meshblu-core-manager-whitelist',
		'metalsmith',
		'mincer',
		'mithril',
		'mraa',
		'msgpack5',
		'n3',
		'nan',
		'newrelic',
		'nib',
		'nightmare',
		'noble',
		'noble-device',
		'node-bourbon',
		'node-fetch',
		'node-fibers',
		'node-gcm',
		'node-icu-charset-detector',
		'node-inspector',
		'node-neat',
		'node-png',
		'node-protobuf',
		'node-proxy',
		'node-ssdp',
		'node-syslog',
		'node-telegram-bot-api',
		'node.flow',
		'nodegit',
		'NodObjC',
		'noflo',
		'npm-registry',
		'npmconf',
		'ntwitter',
		'onoff',
		'opencv',
		'optipng-bin',
		'oracledb',
		'orchestrate',
		'pagelet',
		'parse',
		'pdfkit',
		'pg',
		'pg-query-stream',
		'pg.js',
		'phant-manager-http',
		'picture-tube',
		'pixi.js',
		'player',
		'pmx',
		'posix',
		'progress-stream',
		'prompt',
		'protractor',
		'pty.js',
		'pubnub',
		'pullstream',
		'pygmentize-bundled',
		'qn',
		'qwery',
		'rabbit.js',
		'raf-component',
		'raphael',
		'react-addons-test-utils',
		'react-for-atom',
		'read-stream',
		'ref',
		'ref-struct',
		'rem',
		'require-dir',
		'rethinkdbdash',
		'ripple-lib',
		'rmdir',
		's3',
		'scriptjs',
		'sdk',
		'sharp',
		'simplesmtp',
		'soupselect',
		'source-map-support',
		'source-map-support',
		'standard',
		'stb-util-parse-query',
		'stream-counter',
		'streamifier',
		'streamline-runtime',
		'strip-bom-stream',
		'stylus',
		'sync',
		'tar-pack',
		'tar.gz',
		'tarball-extract',
		'temp-write',
		'template',
		'terminal-menu',
		'through2-map',
		'time',
		'tingle-context',
		'tingle-style',
		'tmodjs',
		'tower-directive',
		'transformer-conversion',
		'tsd',
		'u-css',
		'uglify-js2',
		'unirest',
		'unreachable-branch-transform',
		'unzip',
		'ursa',
		'usage',
		'usb',
		'v8-profiler',
		'velocity-animate',
		'vinyl-buffer',
		'weak',
		'web3',
		'webcomponents.js',
		'webdriverio',
		'webpack-dev-middleware',
		'webpack-dev-server',
		'webshot',
		'weinre',
		'whatwg-fetch',
		'windows.foundation',
		'windows.storage',
		'windows.storage.fileproperties',
		'windows.storage.provider',
		'windows.storage.search',
		'windows.storage.streams',
		'workshopper-exercise',
		'x-log',
		'x-ray',
		'xoauth2',
		'xpc-connection',
		'xtuple-server-lib',
		'xxhash',
		'ytdl-core',
		'yuidocjs',
		'zip-stream',
		'zmq',
		'zrenderjs',
	],
]);

// Some dependencies of dependencies are native modules that fail to compile in the latest Node; use npm-force-resolutions to force a particular version for these transitive dependencies
// See https://github.com/rogeriochaves/npm-force-resolutions#readme
const forceVersionsOfTransitiveDependencies = {
	"iconv": "*"
}

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
		await fileDescriptor.writeFile(`
				{
					"type": "module",
					"dependencies": {},
					"devDependencies": {
						"npm-force-resolutions": "*"
					},
					"scripts": {
						"preinstall": "npx npm-force-resolutions"
					},
					"resolutions": ${JSON.stringify(forceVersionsOfTransitiveDependencies)}
				}
			`);
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
		processStdout.write(`Testing package ${i}: ${name}`);
		let test;
		try {
			test = await import(`./test-app/run-test.js?${i}`);
		} catch {
			continue; // Skip modules that fail to import, e.g. because they assume a browser environment
		}
		const result = test.runTest();
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
