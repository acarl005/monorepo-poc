Mono-Repo Proof of Concept
==========================

A tutorial for setting up and using the mono-repo workflow with NPM, Git, Yarn, and Lerna.
Manage multiple packages and their dependencies with ease and efficiency.

## Requirements

- Git
- NPM
- Yarn >= v1.0.0 (`brew install yarn` or `brew upgrade yarn` if you already have it)
- Lerna (`npm i -g lerna`)

## Initialization

Start with a blank GitHub repository.

```sh
~$ git clone https://github.com/your-org/your-mono.git
~$ cd your-mono
```

You'll need a directory to hold all the packages

```sh
~/your-mono$ mkdir packages
```

Now, initialize the **shared dev dependencies**. For this example, we'll assume Babel is a shared build dependency.

```sh
~/your-mono$ touch package.json
~/your-mono$ edit package.json
```

```js
{
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "devDependencies": {
    "babel-cli": "^6.26.0",
    "lerna": "^2.3.1"
  }
}
```

You'll notice this `package.json` lacks a lot of the usual properties.
That's because this is not an actual package.
This is just a container that lists things shared by all packages.

**NOTE:** Runtime dependencies should not be included here, even if shared by all packages.
Those should go into the dependecies of the actual packages.
Don't worry, yarn will be smart enough to hoist them in the root of the mono-repo to alleviate duplication.

Next, we'll initialize Lerna, a tool for publishing everything together.
**NOTE:** Lerna actually has the ability to bootstrap and symlink in addition to publishing all packages together.
We will be using it only for the publish process, as Yarn handles the other stuff natively using its "workspaces" feature.
At the time of writing, Yarn does not handle publishing as well as Lerna does.

```sh
~/your-mono$ touch lerna.json
~/your-mono$ edit lerna.json
```

```js
{
  "lerna": "2.3.1",
  "version": "1.0.0",
  "npmClient": "yarn",
  "useWorkspaces": true
}
```

Lerna itself is an NPM package.
Its version is specified in this file at the `lerna` property.
`version` is the version of the mono-repo.
We'll begin at `1.0.0`.
`useWorkspaces` tells Lerna to override its own hoisting and linking functionality with Yarn's workspaces, as we will be letting Yarn handle that instead of Lerna.

## Adding packages

Now, you can add your packages into `packages/`.
For this example, suppose we have packages `child`, `parent-1`, and `parent-2`.

```
📂 your-mono
├──📂 packages
│  ├──📂 child
│  │  └──package.json
│  ├──📂 parent-1
│  │  └──package.json
│  └──📂 parent-2
│     └──package.json
├──package.json
└──lerna.json
```

Let's look at the child `package.json`.

```js
{
  "name": "@stem/child",
  "version": "1.0.0",
  "description": "child",
  "main": "dist/index.js",
  "files": [
    "dist/*"
  ],
  "scripts": {
    "clean": "rm -rf dist",
    "build": "npm run clean && babel --out-dir dist src"
  },
  "dependencies": {
    "chalk": "^2.1.0"
  }
}
```

It is a real package, with a `name`, `version`, and `dependencies` of its own.

Now lets have a look at the two parents.

```js
// ~/your-mono/packages/parent-1/package.json
{
  "name": "@stem/parent-1",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "clean": "rm -rf dist",
    "build": "babel --out-dir dist src",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@stem/child": "^1.0.0", // <- depends on child
    "chalk": "^2.1.0"        // <- depends on same version of chalk
  }
}
```

```js
// ~/your-mono/packages/parent-2/package.json
{
  "name": "@stem/parent-2",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "clean": "rm -rf dist",
    "build": "babel --out-dir dist src",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@stem/child": "^1.0.0", // <- depends on child
    "chalk": "2.0.0"         // <- depends on different version of chalk
  }
}
```

Both of these depend on `child`.
Everyone can use `babel` since its in the parent directory and NPM natively resolves packages recursively up the directory chain.
They also depend on `chalk`, although different versions.
`chalk` is a runtime dependency, so even if they all happened to share exactly the same version, it does not belong in the mono-repo `package.json`.
We still want to be able to control the package versions granularly.
Again, Yarn will still hoist `chalk` if the versions *are* compatible.


## Bootstrapping and linking

Let's return to the root, and bootstrap the project and cross-link everything.

```sh
~/your-mono$ yarn
```

What happened?

```sh
📂 your-mono
├──📂 node_modules
│  ├──📂 @stem
│  │  ├──📂 child    ► ../../packages/child    # these are actually symlinks
│  │  ├──📂 parent-1 ► ../../packages/parent-1
│  │  └──📂 parent-2 ► ../../packages/parent-2
│  ├──📂 chalk
│  └──(a BUNCH of other stuff)
├──📂 packages
│  ├──📂 child
│  │  └──package.json
│  ├──📂 parent-1
│  │  └──package.json
│  └──📂 parent-2
│     ├──📂 node_modules
│     │  └──📂 chalk
│     └──package.json
├──package.json
└──lerna.json
```

All packages are universally **symlinked**, so changes across dependencies are seen without re-installing.
Shared packages get hoisted into the root of the mono-repo.
For example, both `child` and `parent-1` have `chalk@^2.1.0`, so `chalk@2.1.0` was installed in the root.
But `parent-2` needs specifically `chalk@2.0.0`, so that got installed inside the `parent-2` package instead of the root.

At this point, the code is ready to be built, run, and dev'd.

## Publishing changes

Suppose we edit `child` and want to publish a new version, as well as pointing both parents to the new version.
After finishing up our changes, we `git commit` them. But we do not need to `git push` or `npm publish` anything.
Lerna will be used for publishing and pushing.

```sh
~/your-mono$ lerna publish
```

This will upgrade the `version` in `lerna.json` and roll the version upgrade to all the affected packages.
So the mono-repo itself, child, parent-1, and parent-2 can become version 1.0.1 all at once in a single command.
The entries in the `package.json` for `parent-1` and `parent-2` will be automatically updated as well to reflect version 1.0.1 of `child`.
We didn't actually make changes to `parent-1` or `parent-2` source code, but we just want to point them to the most up-to-date version of `child`, so they still need to be updated.

Finally, this command also published all affected packages to NPM, created Git tags, and pushed one new commit with the version bump to GitHub (along with the tags).

## Development workflow on an existing mono-repo

If a mono-repo is already set up, all you really have to worry about in your workflow is the following:

1. When you install your node modules: `yarn`. That isn't really a change unless you are using `npm install` instead.
1. You can use `lerna run <command>` to trigger `npm run <command>` in each package, e.g. `lerna run build` will build all packages.
1. Make your changes and commit them.
1. Pushing changes: `lerna publish`

There might be some build and start commands somewhere in there.

## Pros

- [X] **Better workflow:** Easier to run and test your changes when deving across multiple packages.
- [X] **Reduced code complexity:** Easier to manage the build toolchain (Babel), and standards (ESLint).
- [X] **Easier code review:** See all changes and merge them in all in the same place.
- [X] **Eashier sharing of components:** Separate modules make upgrading things a pain.

## Cons

- [ ] **Deployment:** Can we make it smart enough to re-deploy only the services that actually changed?
- [ ] **Version control:** The commit history contains changes for all packages in a single chain. That can be cumbersome. We'll need to be disciplined about squashing.
- [ ] **Heavier:** More code in a single place. `git pull/push` will probably take longer to run.

## More info

[http://blog.shippable.com/our-journey-to-microservices-and-a-mono-repository](http://blog.shippable.com/our-journey-to-microservices-and-a-mono-repository)

