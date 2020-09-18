This is a test of the PR at https://github.com/nodejs/node/pull/33416, that attempts to detect named exports from CommonJS using a lexing approach.

To run this test yourself:

1. Check out the branch from that PR and build Node.

1. Check out this repo, and run the following where `../node/node` is the path to the Node executable you just built in the previous step:

```shell
../node/node --unhandled-rejections=strict main.js
```

When you run the test, most of the top 3,000 packages from the NPM registry will be installed in a subfolder, and then both `require`d and `import`ed, with the names compared between the two loaded packages.
