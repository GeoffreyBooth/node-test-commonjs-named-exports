This is a test of the PR at https://github.com/nodejs/node/pull/33416, that attempts to detect named exports from CommonJS using a lexing approach.

To run this test yourself:

1. Check out the branch from that PR and build Node.
1. In your `node` folder, create a folder `test-packages` and save the files from this gist. Inside the `test-packages` folder, `../node -v` should return `v15.0.0-pre`, to signify that you're running the built version of Node from the PR.
1. Run `npm test`.

When you run the test, most of the top 1000 packages from the NPM registry will be installed in a subfolder, and then both `require`d and `import`ed, with the names compared between the two loaded packages.
