// change any config values here
sofia.config = (sofia.helpers || DOMHelpers).extend(sofia.config, {
	enableOnlineSources: true,
});

// add secondary, custom configuration loaded with ?custom=dbs
sofia.customConfigs = {
	"dbs": {
		customCssUrl: 'dbs.css'
	}
};
