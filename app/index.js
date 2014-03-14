'use strict';
var yeoman = require('yeoman-generator');
var chalk = require('chalk');


var AmdappGenerator = yeoman.generators.Base.extend({
	init: function () {
		this.pkg = require('../package.json');

		this.on('end', function () {
			if (!this.options['skip-install']) {
				this.installDependencies();
			}
		});

		// have Yeoman greet the user
		this.log(this.yeoman);

		// replace it with a short and sweet description of your generator
		this.log(chalk.magenta('You\'re using the fantastic Amdapp generator.'));
	},

	askFor: function () {
		var done = this.async(),
			confRe = this.confRe = /require(?:\.config\((\{[^()]*\})\);)/,
			toUnix = function (path) {
				path = path.replace(/\\/g, "/");
				return path.charAt(path.length) === "/" ? path : path + "/";
			},
			displayConfig = function (path) {
				path = toUnix(path);
				try {
					var content = this.readFileAsString(path);
					this.log(content.match(confRe)[1]);
				} catch (e) {
					this.log("File not found");
				}
				return path;
			}.bind(this);


		var prompts = [{
			type: 'input',
			name: 'tmpdir',
			message: 'Specify a tmp directory the build can mess up:',
			default: './tmp/',
			filter: toUnix
		}, {
			type: 'input',
			name: 'outdir',
			message: 'Specify the build output directory:',
			default: './out/',
			filter: toUnix
		}, {
			type: 'input',
			name: 'loaderconf',
			message: 'Specify the loader config file:',
			default: './requirejs-config.js',
			filter: displayConfig
		}, {
			type: 'confirm',
			name: 'loaderconfC',
			message: 'Is this config correct ?',
			default: true
		}, {
			type: 'confirm',
			name: 'uglify',
			message: 'Do you want to build using uglify ?',
			default: true
		}, {
			type: 'input',
			name: 'layer',
			message: 'Enter the layer name:',
			required: true,
			default: "myapp/src"
		}];

		this.prompt(prompts, function (props) {
			for (var key in props) {
				if (key === "loaderconfC" && props[key]) {
					this.amdloader = 'readConfig("' + props.loaderconf + '"),';
				} else if (key === "loaderconfC" && props[key]) {
					this.amdloader = '{}, //TODO: add amd loader config';
				}
				this[key] = props[key];
			}

			done();
		}.bind(this));
	},

	gruntfile: function () {
		this.template('_Gruntfile.js', 'Gruntfile.js');
	},

	installDeps: function () {
		var deps = ["grunt-amd-build", "grunt-contrib-clean", "grunt-contrib-copy", "grunt-contrib-concat"];
		if (this.uglify) {
			deps.push("grunt-contrib-uglify");
		} else {
			deps.push("grunt-contrib-concat");
		}
		this.npmInstall(deps);
	}
});

module.exports = AmdappGenerator;
