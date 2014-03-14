"use strict";

module.exports = function (grunt) {
	
	var tmpdir = "<%= tmpdir %>",
		outdir = "<%= outdir %>",
		outprop = "amdoutput",
		common = {
			options: {
				banner: "<%%= "+outprop+".header%>"
			},
			src: "<%%= "+outprop+".modules.abs %>",
			dest: outdir + "<%%= "+outprop+".layer %>.js"
		}<% if (loaderconfC) {%>,
		readConfig = function (filepath) {
			var conf = grunt.file.read(filepath).match(<%= confRe %>)[1];
			eval("conf =" + conf);
			return conf;
		}<% } %>;
	
	grunt.initConfig({
		amdloader: <%= amdloader %>
		
		amdbuild: {
			dir: tmpdir,
			layers: {
				"<%= layer %>": {
					include: [
						// Packages listed here will be added to the layer.
					],
					exclude: [
						// Packages listed here will NOT be in the layer.
					]
				}
			}
		},

		amdplugins: {
			text: {
				inlineText: true
			}, 
			i18n: {
				localesList: ["fr"]
			}
		},
		<% if (uglify) { %> 
		uglify: {
			options: {
				sourceMap: true
			},
			dist: common
		},
		<% } else { %> 
		concat: {
			options: {
				separator: ";"
			},
			dist: common
		},
		<% }%>
		copy: {
			dist: {
				expand: true,
				cwd: tmpdir,
				src: "<%%= "+outprop+".plugins.rel %>",
				dest: outdir
			}
		},
		
		clean: {
			erase: [outdir],
			finish: [tmpdir]
		}
	});
	
	
	
	grunt.registerTask("amdbuild", function (amdloader) {
        var name = this.name,
			layers = grunt.config(name).layers,
            layer;
		
		// Clean previous build output.
		grunt.task.run("clean:erase");
		
		for (layer in layers) {
			grunt.task.run("amddepsscan:" + layer + ":"+ name + ":"+ amdloader);
			grunt.task.run("amdplugins:" + layer + ":"+ name + ":"+ amdloader);
			grunt.task.run("amdserialize:" + layer + ":" + name + ":" + outprop);
			<% if (uglify) { %>grunt.task.run("uglify");<%
			 } else { %>grunt.task.run("concat");<% } %>
			grunt.task.run("copy");
			grunt.task.run("clean:finish");
        }
    });
	
	
	// Load the plugin that provides the "amd" task.
	grunt.loadNpmTasks("grunt-amd-build");

	
	<% if (uglify) { %>grunt.loadNpmTasks("grunt-contrib-uglify");<%
	 } else { %>grunt.loadNpmTasks('grunt-contrib-concat');<% } %>
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-clean');

	// Default task(s).
	grunt.registerTask("default", ["amdbuild:amdloader"]);
};
