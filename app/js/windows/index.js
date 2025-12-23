/**
 * Windows Module Index
 * Registers all window types with the registry
 */

import { registerWindowType } from '../core/registry.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { getConfig } from '../core/config.js';

// Import BaseWindow for web components
import { BaseWindow } from './BaseWindow.js';

// Import converted modules
import { TextWindow, BibleWindow, CommentaryWindow } from './TextWindow.js';
import { SearchWindow } from './SearchWindow.js';
import { Scroller } from './Scroller.js';
import { AudioController } from './AudioController.js';
import { MapWindow } from './MapWindow.js';
import { AudioWindow } from './AudioWindow.js';
import { ParallelsWindow } from './ParallelsWindow.js';
import { TextComparisonWindow } from './TextComparisonWindow.js';
import { StatisticsWindow } from './StatisticsWindow.js';
import { DeafBibleWindow } from './DeafBibleWindow.js';
import { MediaWindow } from './MediaWindow.js';

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
  param: 'map',
  className: 'MapWindow',
  WindowClass: MapWindow,
  displayName: 'Map',
  paramKeys: { latitude: 'la', longitude: 'ln' },
  init: { latitude: 31.7833, longitude: 35.2167 }
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
  param: 'commentary',
  className: 'CommentaryWindow',
  WindowClass: CommentaryWindow,
  displayName: 'Commentary',
  paramKeys: { textid: 't', fragmentid: 'v' }
});

export {
  TextWindow,
  BibleWindow,
  CommentaryWindow,
  SearchWindow,
  Scroller,
  AudioController,
  MapWindow,
  AudioWindow,
  ParallelsWindow,
  TextComparisonWindow,
  StatisticsWindow,
  DeafBibleWindow,
  MediaWindow
};

export default {
  BaseWindow,
  TextWindow,
  BibleWindow,
  CommentaryWindow,
  SearchWindow,
  MapWindow,
  AudioWindow,
  ParallelsWindow,
  TextComparisonWindow,
  StatisticsWindow,
  DeafBibleWindow,
  MediaWindow,
  Scroller,
  AudioController
};
