sofia.config = (sofia.helpers || DOMHelpers).extend(sofia.config, {
	siteTitle: '',
	settingsPrefix: '20170923',

	baseContentUrl: 'https://inscript.bible.cloud/',
	serverSearchPath: 'https://arc.dbs.org/api/bible-search/',
	// Icon Skins (icons.svg, icons-pastel.svg, icons-black.svg)
	icons: 'build/icons.svg',

	// First Load Set
	windows: [
		{ type: 'bible', data: { textid: 'ENGWEB', fragmentid: 'JN3_16' } },
		{ type: 'bible', data: { textid: 'ENGKJV', fragmentid: 'JN3_16' } }
	],
	newBibleWindowVersion: 'ENGWEB',
	deafBibleWindowDefaultBibleVersion: 'ASESLS',
	newCommentaryWindowTextId: 'comm_eng_tske',

	// Switches
	enableBibleSelectorTabs: false,
	enableFeedback: true,
	eng2pEnableAll: true,
	enableAmericanBibleSociety: false,
	enableDeafBibleWindow: false,
	deafCentric: false,

	// Enables the use of online sources (Google Maps, FCBH, Jesus Film, etc.)
	enableOnlineSources: false
});
