/**
 * Windows Module Index
 * Imported once (`import './windows/index.js'`) purely for the side effect of
 * registering every window type with the registry. Nothing imports its members.
 */

import { registerWindowType } from '../core/registry.js';

import { getConfig } from '../core/config.js';

import { BibleWindow, CommentaryWindow } from './TextWindow.js';
import { SearchWindow } from './SearchWindow.js';
import { AudioWindow } from './AudioWindow.js';
import { ParallelsWindow } from './ParallelsWindow.js';
import { TextComparisonWindow } from './TextComparisonWindow.js';
import { StatisticsWindow } from './StatisticsWindow.js';
import { DeafBibleWindow } from './DeafBibleWindow.js';
import { MediaWindow } from './MediaWindow.js';
import { MapWindow } from './MapWindow/MapWindow.js';
import { NotesWindow } from './NotesWindow.js';

const config = getConfig();
registerWindowType({
  param: 'bible',
  className: 'BibleWindow',
  WindowClass: BibleWindow,
  displayName: 'Bible',
  paramKeys: { textid: 't', fragmentid: 'v' }
});

registerWindowType({
  param: 'search',
  className: 'SearchWindow',
  WindowClass: SearchWindow,
  displayName: 'Search',
  paramKeys: { textid: 't', searchtext: 's' }
});

registerWindowType({
  param: 'audio',
  className: 'AudioWindow',
  WindowClass: AudioWindow,
  displayName: 'Audio',
  paramKeys: { textid: 't', fragmentid: 'v' }
});

registerWindowType({
  param: 'parallel',
  className: 'ParallelsWindow',
  WindowClass: ParallelsWindow,
  displayName: 'Parallels',
  paramKeys: { textid: 't', parallelid: 'p' }
});

registerWindowType({
  param: 'comparison',
  className: 'TextComparisonWindow',
  WindowClass: TextComparisonWindow,
  displayName: 'Comparison',
  paramKeys: { textids: 't', fragmentid: 'f' },
  init: {
    textids: `${config.newComparisonWindowSourceVersion}, ${config.newComparisonWindowTargetVersion}`,
    fragmentid: 'John 3:16'
  }
});

registerWindowType({
  param: 'stats',
  className: 'StatisticsWindow',
  WindowClass: StatisticsWindow,
  displayName: 'Statistics',
  paramKeys: {}
});

registerWindowType({
  param: 'deafbible',
  className: 'DeafBibleWindow',
  WindowClass: DeafBibleWindow,
  displayName: 'Deaf Bible',
  paramKeys: { textid: 't', fragmentid: 'v' }
});

registerWindowType({
  param: 'media',
  className: 'MediaWindow',
  WindowClass: MediaWindow,
  displayName: 'Media',
  paramKeys: {}
});

registerWindowType({
  param: 'map',
  className: 'MapWindow',
  WindowClass: MapWindow,
  displayName: 'Map',
  paramKeys: { latitude: 'lat', longitude: 'lon' }
});

registerWindowType({
  param: 'commentary',
  className: 'CommentaryWindow',
  WindowClass: CommentaryWindow,
  displayName: 'Commentary',
  paramKeys: { textid: 't', fragmentid: 'v' }
});

registerWindowType({
  param: 'notes',
  className: 'NotesWindow',
  WindowClass: NotesWindow,
  displayName: 'Notes',
  paramKeys: { noteId: 'n', filter: 'f' }
});
