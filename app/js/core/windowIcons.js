/**
 * Window Icon Registry
 * Maps window class names to inline SVG markup for tabs and menu buttons
 */

import bibleSvg from '../../css/images/bible1.svg?raw';
import commentarySvg from '../../css/images/commentary.svg?raw';
import searchSvg from '../../css/images/search.svg?raw';
import comparisonSvg from '../../css/images/comparison.svg?raw';
import notesSvg from '../../css/images/notes.svg?raw';
import picturesSvg from '../../css/images/pictures.svg?raw';
import parallelSvg from '../../css/images/parallel.svg?raw';
import statsSvg from '../../css/images/stats.svg?raw';
import audioEarSvg from '../../css/images/audio-ear.svg?raw';
import mapSvg from '../../css/images/map.svg?raw';
import signLanguageSvg from '../../css/images/sign-language.svg?raw';
import highlighterSvg from '../../css/images/highlighter.svg?raw';
import flashcardSvg from '../../css/images/flashcard.svg?raw';
import gearSvg from '../../css/images/gear-black.svg?raw';
import aboutSvg from '../../css/images/about.svg?raw';

const windowIcons = {
  BibleWindow: bibleSvg,
  CommentaryWindow: commentarySvg,
  SearchWindow: searchSvg,
  TextComparisonWindow: comparisonSvg,
  NotesWindow: notesSvg,
  MediaWindow: picturesSvg,
  ParallelsWindow: parallelSvg,
  StatisticsWindow: statsSvg,
  AudioWindow: audioEarSvg,
  MapWindow: mapSvg,
  DeafBibleWindow: signLanguageSvg,
  FlashcardWindow: flashcardSvg,
  highlighter: highlighterSvg,
  settings: gearSvg,
  about: aboutSvg,
};

export function getWindowIcon(className) {
  return windowIcons[className] || null;
}

export default windowIcons;
