"use strict";
var yeoman = require("yeoman-generator");
var chalk = require("chalk");
var esprima = require("esprima");

var AmdBuildGenerator = yeoman.generators.Base.extend({
	init: function () {
		// Enhance gruntfile editor
		this.gruntfile.registerTaskOnce = function (name, func) {
			var nodes = this.gruntfile.callExpression("grunt.registerTask").filter(function (node) {
				return node.arguments[0].value === name;
			}).nodes;

			if (nodes.length > 0) {
				// Use a var statement to get a functionExpression
				var arg = esprima.parse("var a = " + func);
				nodes[0].arguments[1] = arg.body[0].declarations[0].init;
			} else {
				this.gruntfile.assignment('module.exports').value().body.append(
					"grunt.registerTask(\"" + name + "\", " + func + ")"
				);
			}
		};
		this.gruntfile.loadNpmTasksOnce = function (name) {
			var loadNpmExist = this.gruntfile.callExpression("grunt.loadNpmTasks").filter(function (node) {
				return node.arguments[0].value === name;
			}).length > 0;

			if (!loadNpmExist) {
				this.gruntfile.assignment('module.exports').value().body.prepend(
					"grunt.loadNpmTasks(\"" + name + "\")"
				);
			}
		};

		// have Yeoman greet the user
		this.log(this.yeoman);

		// replace it with a short and sweet description of your generator
		this.log("This generator adds configuration for " + chalk.cyan("grunt-amd-build") + " to your gruntfile.");
	},

	askFor: function () {
		var done = this.async(),
			confRe = /require(?:\.config\((\{[^()]*\})\);)/,
			toUnix = function (path) {
				return path.replace(/\\/g, "/");
			},
			toDir = function (path) {
				return toUnix(path).charAt(path.length - 1) === "/" ? path : path + "/";
			};


		this.answers = {};

		var configPrompt = {
			type: "input",
			name: "loaderConfig",
			message: "Enter the filepath of the file containing requirejs config:",
			default: "index.html",
			filter: toDir
		};

		var retryConfigPrompt = {
			type: "confirm",
			name: "retryConfig",
			message: "The file was not found, do you want to retry ?",
			default: true
		};

		var confirmConfigPrompt = {
			type: "confirm",
			name: "confirmConfig",
			message: "Is this config correct ?",
			default: true
		};

		var getLoaderConfig = function (ans) {
			var path = toUnix(ans.loaderConfig);

			this.answers.loaderConfig = "{ /* TODO: add amd loader config */ }";
			try {
				var config = this.dest.read(path).match(confRe)[1];
				this.log("Found configuration:");
				this.log(JSON.stringify(eval("new Object(" + config + ")"), null, 2));
				this.prompt(confirmConfigPrompt, function (props) {
					if (props.confirmConfig) {
						this.answers.loaderConfig = config;
						this.prompt(mainsPrompt, getMains);
					}
				}.bind(this));
			} catch (e) {
				this.prompt(retryConfigPrompt, function (props) {
					if (props.retryConfig) {
						this.prompt(configPrompt, getLoaderConfig);
					} else {
						this.prompt(mainsPrompt, getMains);
					}
				}.bind(this));
			}
		}.bind(this);

		var mainsPrompt = {
			type: "input",
			name: "mains",
			message: "Enter the id of your application entry-point(s)\n (use comma-separated list to add several):",
			default: "js/app"
		};

		var getMains = function (ans) {
			var mains = ans.mains.replace(/\s/g, "").replace(/^,/, "").replace(/,$/, "").split(",").map(toUnix);
			if (mains.length > 1) {
				this.answers.includes = mains;
				this.prompt(layerNamePrompt, getLayerName);
			} else {
				this.answers.layerName = mains[0];
				this.answers.includes = [];
				this.prompt(uglifyPrompts, getUglify);
			}
		}.bind(this);

		var layerNamePrompt = {
			type: "input",
			name: "layerName",
			message: "Enter the name of the layer to build:",
			default: "js/layer",
			filter: toUnix
		};

		var getLayerName = function (ans) {
			this.answers.layerName = ans.layerName;
			this.prompt(uglifyPrompts, getUglify);
		}.bind(this);

		var uglifyPrompts = [{
			type: "confirm",
			name: "uglify",
			message: "Do you want to use uglify to optimize the layer ?",
			default: true
		}, {
			type: "confirm",
			name: "sourcemap",
			message: "Do you want to use source map to debug the layer ?",
			default: false,
			when: function (uglify) {
				return uglify.uglify;
			}
		}];

		var getUglify = function (ans) {
			this.answers.uglify = ans.uglify;
			this.answers.sourcemap = ans.sourcemap;
			this.prompt(outPrompt, getOut);
		}.bind(this);

		var outPrompt = {
			type: "input",
			name: "out",
			message: "Enter the path to the output directory for the build:",
			default: "./build",
			filter: toDir
		};

		var getOut = function (ans) {
			this.answers.out = ans.out;
			done();
		}.bind(this);

		// Start the prompt
		this.prompt(configPrompt, getLoaderConfig);
	},

	getTmpDir: function () {
		var path = "tmp";
		var index = 0;
		while (this.src.exists(path)) {
			index++;
			path = "tmp" + index;
		}
		this.answers.tmp = "./" + path + "/";
	},

	setGruntVariable: function () {
		var variables = {
			common: "{" +
				"options: { " +
				"	banner: \"<%= \" + outprop + \".header%>\"" +
				"}," +
				"src: \"<%= \" + outprop + \".modules.abs %>\"," +
				"dest: outdir + \"<%= \" + outprop + \".layerPath %>\"" +
				"}",
			tmpdir: "\"" + this.answers.tmp + "\"",
			outdir: "\"" + this.answers.out + "\"",
			outprop: "\"amdoutput\""
		};

		Object.keys(variables).forEach(function (key) {
			this.gruntfile.insertVariable(key, variables[key]);
		}.bind(this));
	},

	setGruntConfig: function () {
		this.gruntfile.insertConfig("amdloader", this.answers.loaderConfig);
		this.gruntfile.insertConfig("amdbuild", "{" +
			"	dir: tmpdir," +
			"	layers: [{" +
			"		name: \"" + this.answers.layerName + "\"," +
			"		include: " + JSON.stringify(this.answers.includes) +
			"	}]" +
			"}");

		if (this.answers.uglify) {
			this.gruntfile.insertConfig("uglify", "{" +
				(this.answers.sourcemap ? "options: { sourceMap: true }," : "") +
				"	dist: common" +
				"}");
		} else {
			this.gruntfile.insertConfig("concat", "{" +
				"	options: { separator: \";\" }," +
				"	dist: common" +
				"}");
		}

		this.gruntfile.insertConfig("copy", "{" +
			"	plugins: {" +
			"		expand: true," +
			"		cwd: tmpdir," +
			"		src: \"<%= \" + outprop + \".plugins.rel %>\"," +
			"		dest: outdir" +
			"	}" +
			"}");

		this.gruntfile.insertConfig("clean", "{" +
			(this.answers.sourcemap ? "" : "finish: [tmpdir],") +
			"	erase: [outdir]" +
			"}");
	},

	setGruntTasks: function () {
		this.gruntfile.loadNpmTasksOnce("grunt-amd-build");
		if (this.answers.uglify) {
			this.gruntfile.loadNpmTasksOnce("grunt-contrib-uglify");
		} else {
			this.gruntfile.loadNpmTasksOnce("grunt-contrib-concat");
		}
		this.gruntfile.loadNpmTasksOnce("grunt-contrib-copy");
		this.gruntfile.loadNpmTasksOnce("grunt-contrib-clean");

		var mainTask = "function (amdloader) {" +
			"var name = this.name," +
			"	layers = grunt.config(name).layers;" +

			"layers.forEach(function (layer) {" +
			"	grunt.task.run(\"amddepsscan:\" + layer.name + \":\" + name + \":\" + amdloader);" +
			"	grunt.task.run(\"amdserialize:\" + layer.name + \":\" + name + \":\" + outprop);" +
			"	grunt.task.run(\"" + (this.answers.uglify ? "uglify" : "concat") + "\");" +
			"	grunt.task.run(\"copy:plugins\");" +
			"});" +
			"}";

		this.gruntfile.registerTaskOnce("amdbuild", mainTask);

		var tasks = ["clean:erase", "amdbuild:amdloader", "amdreportjson:amdbuild"];
		// Remove tmp folder if there is no sourcemap
		!this.answers.sourcemap && tasks.push("clean:finish");
		this.gruntfile.registerTaskOnce("build", "[\"" + tasks.join("\", \"") + "\"]");
	},

	installDeps: function () {
		var done = this.async();
		var deps = ["grunt-amd-build", "grunt-contrib-clean", "grunt-contrib-copy", "clean-css"];
		if (this.answers.uglify) {
			deps.push("grunt-contrib-uglify");
		} else {
			deps.push("grunt-contrib-concat");
		}
		this.npmInstall(deps, {
			saveDev: true
		}, done);
	},

	finish: function () {
		this.log();
		if (this.answers.loaderConfig === "{ /* TODO: add amd loader config */ }") {
			this.log(chalk.yellow("You should manually set requirejs configuration in the Gruntfile \n" +
				"before building your application."));
		} else {
			this.log(chalk.green("Everything should now be set up."));
		}
		this.log("You can run " + chalk.cyan("\"grunt build\"") + " to build your application");
		this.log();
	}
});

module.exports = AmdBuildGenerator;
