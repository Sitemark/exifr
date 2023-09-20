import pkg from "./package.json" assert { type: "json"};

export default {
		input: "src/index.mjs",
		external: [/node_modules/],
		output: [
			{ 
				dir: "dist/cjs",
				format: "cjs",
				preserveModules: true,
				preserveModulesRoot: "src",
			},
			{ 
				dir: "dist/esm",
				format: "esm",
				preserveModules: true,
				preserveModulesRoot: "src",
			}
		]
};
