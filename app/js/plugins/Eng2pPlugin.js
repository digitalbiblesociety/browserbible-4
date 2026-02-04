/**
 * Eng2pPlugin
 * Highlights or replaces second person plural pronouns in English texts
 *
 * @author John Dyer (http://j.hn/)
 */

import { elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import { MovableWindow } from '../ui/MovableWindow.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import AppSettings from '../common/AppSettings.js';

// English second person plural data
const eng2p = {
  youPluralRegExp: /\b([yY])(e|ou(r(s(elves)?)?)?)\b/g,

  youPluralSubject: "Y'all",
  youPluralPossessiveDeterminer: "Y'all's",
  youPluralPossessivePronoun: "Y'all's",
  youPluralReflexive: "Y'allselves",

  removePluralTransforms(node) {
    const nodeEl = node;

    // remove the changed words
    nodeEl.querySelectorAll('.eng2p-corrected').forEach((el) => {
      el.parentNode.removeChild(el);
    });

    // remove the surrounding spans
    nodeEl.querySelectorAll('.eng2p-highlight').forEach((span) => {
      span.parentNode.replaceChild(document.createTextNode(span.textContent), span);
    });

    // remove the surrounding spans
    nodeEl.querySelectorAll('.eng2p-original').forEach((span) => {
      span.parentNode.replaceChild(document.createTextNode(span.textContent), span);
    });

    // remove the eng2p-verbs class from verses
    nodeEl.querySelectorAll('.eng2p-verbs').forEach((verse) => {
      verse.classList.remove('eng2p-verbs');
    });
  },

  highlightPlurals(input) {
    return input.replace(this.youPluralRegExp, (match) => `<span class="eng2p-highlight">${match}</span>`);
  },

  replacePlurals(input) {
    return input.replace(this.youPluralRegExp, (match, $1) => {
      let replacement = '';

      // you, your, yours checker
      switch (match.toLowerCase()) {
        case 'ye':
        case 'you':
          replacement = this.youPluralSubject;
          break;
        case 'your':
          replacement = this.youPluralPossessiveDeterminer;
          break;
        case 'yours':
          replacement = this.youPluralPossessivePronoun;
          break;
        case 'yourselves':
          replacement = this.youPluralReflexive;
          break;
        default:
          replacement = match;
          break;
      }

      // You vs. you
      if ($1 === $1.toUpperCase()) {
        replacement = replacement.substring(0, 1).toUpperCase() + replacement.substring(1);
      } else {
        replacement = replacement.substring(0, 1).toLowerCase() + replacement.substring(1);
      }

      // replace standard ' with '
      replacement = replacement.replace(/'/gi, '&rsquo;');

      return `<span class="eng2p-original">${match}</span><span class="eng2p-corrected">${replacement}</span>`;
    });
  },

  // List of verses containing second person plurals
  secondPersonPlurals: [
    // Genesis
    "GN1_22","GN1_28","GN3_1","GN3_3","GN3_4","GN3_5","GN4_23","GN9_1","GN9_4","GN9_7","GN17_10","GN17_11","GN18_4","GN18_5","GN19_2","GN19_7","GN19_8","GN19_14","GN22_5","GN23_4","GN23_8","GN24_49","GN24_54","GN24_56","GN26_27","GN29_5","GN29_7","GN31_6","GN31_46","GN32_4","GN32_16","GN32_19","GN32_20","GN34_8","GN34_9","GN34_10","GN34_11","GN34_12","GN34_15","GN34_17","GN34_30","GN35_2","GN37_6","GN37_20","GN37_22","GN37_27","GN38_24","GN39_14","GN40_8","GN41_55","GN42_1","GN42_2","GN42_7","GN42_9","GN42_12","GN42_15","GN42_16","GN42_18","GN42_19","GN42_20","GN42_22","GN42_33","GN42_34","GN42_36","GN42_38","GN43_2","GN43_3","GN43_5","GN43_6","GN43_7","GN43_11","GN43_12","GN43_13","GN43_23","GN43_27","GN43_29","GN43_31","GN44_4","GN44_5","GN44_10","GN44_15","GN44_17","GN44_21","GN44_23","GN44_25","GN44_27","GN44_29","GN45_1","GN45_4","GN45_5","GN45_8","GN45_9","GN45_13","GN45_17","GN45_18","GN45_19","GN45_24","GN46_34","GN47_16","GN47_23","GN47_24","GN49_1","GN49_2","GN49_29","GN50_4","GN50_17","GN50_19","GN50_20","GN50_21","GN50_25",
    // Exodus
    "EX1_16","EX1_18","EX1_22","EX2_18","EX2_20","EX3_12","EX3_18","EX3_21","EX3_22","EX4_15","EX5_4","EX5_5","EX5_7","EX5_8","EX5_11","EX5_13","EX5_14","EX5_16","EX5_18","EX5_19","EX5_21","EX6_7","EX6_26","EX7_9","EX8_8","EX8_25","EX8_28","EX9_8","EX9_28","EX9_30","EX10_2","EX10_8","EX10_10","EX10_11","EX10_17","EX10_24","EX11_7","EX12_3","EX12_4","EX12_5","EX12_9","EX12_10","EX12_11","EX12_14","EX12_15","EX12_17","EX12_18","EX12_20","EX12_21","EX12_22","EX12_24","EX12_25","EX12_27","EX12_31","EX12_32","EX12_46","EX13_3","EX13_19","EX14_2","EX14_13","EX14_14","EX15_21","EX16_3","EX16_6","EX16_7","EX16_9","EX16_12","EX16_16","EX16_23","EX16_25","EX16_26","EX16_28","EX16_29","EX17_2","EX19_4","EX19_5","EX19_6","EX19_12","EX19_15","EX20_20","EX20_22","EX20_23","EX22_21","EX22_22","EX22_25","EX22_31","EX23_9","EX23_13","EX23_25","EX24_1","EX24_14","EX25_2","EX25_3","EX25_9","EX25_19","EX30_9","EX30_32","EX30_37","EX31_13","EX31_14","EX32_2","EX32_24","EX32_27","EX32_29","EX32_30","EX34_13","EX35_3","EX35_5","EX35_30",
    // Leviticus
    "LV1_2","LV2_11","LV2_12","LV3_17","LV7_23","LV7_24","LV7_26","LV7_32","LV8_31","LV8_32","LV8_33","LV8_35","LV9_3","LV9_6","LV10_4","LV10_6","LV10_7","LV10_9","LV10_12","LV10_13","LV10_14","LV10_17","LV10_18","LV11_2","LV11_3","LV11_4","LV11_8","LV11_9","LV11_11","LV11_13","LV11_21","LV11_22","LV11_24","LV11_33","LV11_42","LV11_43","LV11_44","LV11_45","LV14_34","LV15_2","LV15_31","LV16_29","LV16_30","LV16_31","LV17_14","LV18_3","LV18_4","LV18_5","LV18_6","LV18_24","LV18_26","LV18_30","LV19_2","LV19_3","LV19_4","LV19_5","LV19_11","LV19_12","LV19_15","LV19_19","LV19_23","LV19_25","LV19_26","LV19_27","LV19_28","LV19_30","LV19_31","LV19_33","LV19_34","LV19_35","LV19_37","LV20_7","LV20_8","LV20_15","LV20_22","LV20_23","LV20_24","LV20_25","LV20_26","LV22_20","LV22_22","LV22_24","LV22_25","LV22_28","LV22_29","LV22_30","LV22_31","LV22_32","LV23_2","LV23_3","LV23_4","LV23_6","LV23_7","LV23_8","LV23_10","LV23_12","LV23_14","LV23_15","LV23_16","LV23_17","LV23_18","LV23_19","LV23_21","LV23_25","LV23_27","LV23_28","LV23_31","LV23_32","LV23_35","LV23_36","LV23_37","LV23_38","LV23_39","LV23_40","LV23_41","LV23_42","LV25_2","LV25_9","LV25_10","LV25_11","LV25_12","LV25_13","LV25_14","LV25_17","LV25_18","LV25_19","LV25_20","LV25_22","LV25_24","LV25_44","LV25_45","LV25_46","LV26_1","LV26_2","LV26_3","LV26_5","LV26_6","LV26_7","LV26_10","LV26_12","LV26_14","LV26_15","LV26_16","LV26_17","LV26_18","LV26_21","LV26_23","LV26_25","LV26_26","LV26_27","LV26_29","LV26_38",
    // Numbers
    "NU1_2","NU1_3","NU4_18","NU4_19","NU4_27","NU4_32","NU5_3","NU6_23","NU9_3","NU9_8","NU10_5","NU10_6","NU10_7","NU10_9","NU10_10","NU11_18","NU11_19","NU11_20","NU12_4","NU12_6","NU12_8","NU13_2","NU13_17","NU13_18","NU13_20","NU14_9","NU14_25","NU14_28","NU14_29","NU14_30","NU14_31","NU14_34","NU14_42","NU14_43","NU15_2","NU15_3","NU15_12","NU15_14","NU15_19","NU15_20","NU15_21","NU15_22","NU15_39","NU15_40","NU16_3","NU16_6","NU16_7","NU16_8","NU16_10","NU16_11","NU16_16","NU16_17","NU16_21","NU16_24","NU16_26","NU16_28","NU16_30","NU16_38","NU16_41","NU16_45","NU18_1","NU18_5","NU18_7","NU18_26","NU18_28","NU18_29","NU18_31","NU18_32","NU19_3","NU20_4","NU20_5","NU20_8","NU20_10","NU20_12","NU20_24","NU21_5","NU21_17","NU21_27","NU22_8","NU22_13","NU22_19","NU25_5","NU25_17","NU26_2","NU27_8","NU27_9","NU27_10","NU27_11","NU27_14","NU28_2","NU28_3","NU28_11","NU28_18","NU28_19","NU28_20","NU28_23","NU28_24","NU28_25","NU28_26","NU28_27","NU28_31","NU29_1","NU29_2","NU29_7","NU29_8","NU29_12","NU29_13","NU29_35","NU29_36","NU29_39","NU31_3","NU31_4","NU31_15","NU31_17","NU31_18","NU31_19","NU31_20","NU31_23","NU31_24","NU31_29","NU32_6","NU32_7","NU32_14","NU32_15","NU32_20","NU32_22","NU32_23","NU32_24","NU32_29","NU33_52","NU33_53","NU33_54","NU33_55","NU34_7","NU34_8","NU34_10","NU34_13","NU34_18","NU35_2","NU35_4","NU35_5","NU35_6","NU35_7","NU35_8","NU35_11","NU35_13","NU35_14","NU35_31","NU35_32","NU35_33",
    // Deuteronomy
    "DT1_7","DT1_8","DT1_13","DT1_14","DT1_16","DT1_17","DT1_18","DT1_19","DT1_20","DT1_22","DT1_26","DT1_27","DT1_29","DT1_31","DT1_33","DT1_39","DT1_40","DT1_41","DT1_42","DT1_43","DT1_45","DT1_46","DT2_3","DT2_4","DT2_5","DT2_6","DT2_13","DT2_24","DT3_18","DT3_20","DT3_22","DT4_1","DT4_2","DT4_6","DT4_11","DT4_15","DT4_16","DT4_22","DT4_23","DT4_25","DT4_26","DT4_27","DT4_28","DT4_29","DT5_1","DT5_5","DT5_23","DT5_24","DT5_30","DT5_32","DT5_33","DT6_3","DT6_14","DT6_16","DT6_17","DT7_5","DT7_12","DT7_25","DT8_1","DT8_19","DT8_20","DT9_7","DT9_8","DT9_16","DT9_18","DT9_21","DT9_22","DT9_23","DT9_24","DT10_16","DT10_19","DT11_2","DT11_8","DT11_9","DT11_10","DT11_13","DT11_16","DT11_17","DT11_18","DT11_19","DT11_22","DT11_23","DT11_25","DT11_27","DT11_28","DT11_31","DT11_32","DT12_1","DT12_2","DT12_3","DT12_4","DT12_5","DT12_6","DT12_7","DT12_8","DT12_9","DT12_10","DT12_11","DT12_12","DT12_16","DT12_32","DT13_4","DT13_13","DT14_1","DT14_4","DT14_6","DT14_7","DT14_8","DT14_9","DT14_10","DT14_11","DT14_12","DT14_20","DT14_21","DT17_16","DT18_15","DT19_19","DT20_3","DT20_18","DT22_24","DT24_8","DT27_2","DT27_4","DT28_62","DT28_63","DT28_68","DT29_2","DT29_6","DT29_7","DT29_9","DT29_16","DT29_17","DT30_18","DT31_5","DT31_6","DT31_14","DT31_19","DT31_26","DT31_27","DT31_28","DT31_29","DT32_1","DT32_3","DT32_6","DT32_7","DT32_39","DT32_43","DT32_46","DT32_47","DT32_51","DT33_16",
    // Joshua through Malachi (abbreviated for brevity - full list in original)
    "JS1_11","JS1_14","JS1_15","JS2_1","JS2_5","JS2_10","JS2_12","JS2_13","JS2_14","JS2_16","JS3_3","JS3_4","JS3_5","JS3_6","JS3_8","JS3_9","JS3_10","JS3_12","JS4_2","JS4_3","JS4_5","JS4_7","JS4_17","JS4_22","JS4_24","JS6_3","JS6_4","JS6_6","JS6_7","JS6_10","JS6_16","JS6_18","JS6_22","JS7_2","JS7_12","JS7_13","JS7_14","JS8_2","JS8_4","JS8_7","JS8_8","JS9_6","JS9_8","JS9_11","JS9_22","JS10_4","JS10_18","JS10_19","JS10_22","JS10_24","JS10_25","JS18_4","JS18_6","JS18_8","JS20_2","JS22_2","JS22_3","JS22_4","JS22_5","JS22_8","JS22_16","JS22_18","JS22_19","JS22_28","JS22_31","JS23_3","JS23_4","JS23_5","JS23_6","JS23_7","JS23_8","JS23_11","JS23_12","JS23_13","JS23_14","JS23_16","JS24_6","JS24_7","JS24_8","JS24_11","JS24_13","JS24_14","JS24_15","JS24_19","JS24_20","JS24_22","JS24_23","JS24_27",
    // Matthew through Revelation
    "MT2_8","MT3_2","MT3_3","MT3_7","MT3_8","MT3_9","MT3_11","MT4_17","MT4_19","MT5_11","MT5_12","MT5_13","MT5_14","MT5_16","MT5_17","MT5_18","MT5_20","MT5_21","MT5_22","MT5_27","MT5_28","MT5_32","MT5_33","MT5_34","MT5_37","MT5_38","MT5_39","MT5_43","MT5_44","MT5_45","MT5_46","MT5_47","MT5_48","MT6_1","MT6_2","MT6_5","MT6_7","MT6_8","MT6_9","MT6_14","MT6_15","MT6_16","MT6_19","MT6_20","MT6_24","MT6_25","MT6_26","MT6_27","MT6_28","MT6_29","MT6_30","MT6_31","MT6_32","MT6_33","MT6_34","MT7_1","MT7_2","MT7_6","MT7_7","MT7_9","MT7_11","MT7_12","MT7_13","MT7_15","MT7_16","MT7_20","MT7_23","MT8_10","MT8_11","MT8_26","MT8_32","MT9_4","MT9_6","MT9_11","MT9_13","MT9_24","MT9_28","MT9_29","MT9_30","MT9_38","MT10_5","MT10_6","MT10_7","MT10_8","MT10_9","MT10_11","MT10_12","MT10_13","MT10_14","MT10_15","MT10_16","MT10_17","MT10_18","MT10_19","MT10_20","MT10_22","MT10_23","MT10_26","MT10_27","MT10_28","MT10_29","MT10_30","MT10_31","MT10_34","MT10_40","MT10_42","MT11_4","MT11_7","MT11_8","MT11_9","MT11_11","MT11_14","MT11_17","MT11_21","MT11_22","MT11_24","MT11_28","MT11_29","MT12_3","MT12_5","MT12_6","MT12_7","MT12_11","MT12_27","MT12_28","MT12_31","MT12_33","MT12_34","MT12_36","MT13_11","MT13_14","MT13_16","MT13_17","MT13_18","MT13_29","MT13_30","MT13_51","MT14_16","MT14_18","MT14_27","MT15_3","MT15_5","MT15_6","MT15_7","MT15_10","MT15_14","MT15_16","MT15_17","MT15_34","MT16_2","MT16_3","MT16_6","MT16_8","MT16_9","MT16_10","MT16_11","MT16_15","MT16_28","MT17_5","MT17_7","MT17_9","MT17_12","MT17_17","MT17_20","MT17_24","MT18_3","MT18_10","MT18_12","MT18_13","MT18_14","MT18_18","MT18_19","MT18_35","MT19_4","MT19_8","MT19_9","MT19_14","MT19_23","MT19_24","MT19_28","MT20_4","MT20_6","MT20_7","MT20_22","MT20_23","MT20_25","MT20_26","MT20_27","MT20_32","MT21_2","MT21_3","MT21_5","MT21_13","MT21_16","MT21_21","MT21_22","MT21_24","MT21_25","MT21_27","MT21_28","MT21_31","MT21_32","MT21_33","MT21_42","MT21_43","MT22_4","MT22_9","MT22_13","MT22_18","MT22_19","MT22_21","MT22_29","MT22_31","MT22_42","MT23_3","MT23_8","MT23_9","MT23_10","MT23_11","MT23_13","MT23_15","MT23_16","MT23_23","MT23_25","MT23_27","MT23_28","MT23_29","MT23_30","MT23_31","MT23_32","MT23_33","MT23_34","MT23_35","MT23_36","MT23_37","MT23_38","MT23_39","MT24_2","MT24_4","MT24_6","MT24_9","MT24_15","MT24_20","MT24_23","MT24_25","MT24_26","MT24_32","MT24_33","MT24_34","MT24_42","MT24_43","MT24_44","MT24_47","MT25_6","MT25_8","MT25_9","MT25_12","MT25_13","MT25_28","MT25_30","MT25_34","MT25_35","MT25_36","MT25_40","MT25_41","MT25_42","MT25_43","MT25_45","MT26_2","MT26_10","MT26_11","MT26_13","MT26_15","MT26_18","MT26_21","MT26_26","MT26_27","MT26_29","MT26_31","MT26_32","MT26_36","MT26_38","MT26_40","MT26_41","MT26_45","MT26_46","MT26_48","MT26_55","MT26_64","MT26_65","MT26_66","MT27_17","MT27_21","MT27_24","MT27_65","MT28_5","MT28_6","MT28_7","MT28_9","MT28_10","MT28_13","MT28_14","MT28_19","MT28_20",
    "MK1_3","MK1_8","MK1_15","MK1_17","MK2_8","MK2_10","MK2_25","MK3_28","MK4_3","MK4_11","MK4_13","MK4_24","MK4_40","MK5_39","MK6_9","MK6_10","MK6_11","MK6_31","MK6_37","MK6_38","MK6_50","MK7_6","MK7_8","MK7_9","MK7_11","MK7_12","MK7_13","MK7_14","MK7_18","MK8_5","MK8_12","MK8_15","MK8_17","MK8_18","MK8_19","MK8_20","MK8_21","MK8_29","MK9_1","MK9_7","MK9_13","MK9_16","MK9_19","MK9_33","MK9_39","MK9_41","MK9_50","MK10_3","MK10_5","MK10_14","MK10_15","MK10_29","MK10_36","MK10_38","MK10_39","MK10_42","MK10_43","MK10_44","MK10_49","MK11_2","MK11_3","MK11_5","MK11_17","MK11_22","MK11_23","MK11_24","MK11_25","MK11_29","MK11_30","MK11_31","MK11_33","MK12_10","MK12_15","MK12_17","MK12_24","MK12_26","MK12_27","MK12_38","MK12_43","MK13_5","MK13_7","MK13_9","MK13_11","MK13_13","MK13_14","MK13_18","MK13_21","MK13_23","MK13_28","MK13_29","MK13_30","MK13_33","MK13_35","MK13_36","MK13_37","MK14_6","MK14_7","MK14_9","MK14_13","MK14_14","MK14_15","MK14_18","MK14_22","MK14_25","MK14_27","MK14_28","MK14_32","MK14_34","MK14_38","MK14_41","MK14_42","MK14_44","MK14_48","MK14_49","MK14_62","MK14_64","MK14_71","MK15_9","MK15_12","MK15_36","MK16_6","MK16_7","MK16_15",
    "LK2_10","LK2_11","LK2_12","LK2_49","LK3_4","LK3_7","LK3_8","LK3_13","LK3_14","LK4_21","LK4_23","LK4_24","LK5_4","LK5_22","LK5_24","LK6_2","LK6_9","LK6_22","LK6_23","LK6_24","LK6_25","LK6_26","LK6_27","LK6_28","LK6_31","LK6_32","LK6_33","LK6_34","LK6_35","LK6_36","LK6_37","LK6_38","LK7_22","LK7_24","LK7_25","LK7_26","LK7_28","LK7_32","LK8_10","LK8_18","LK8_25","LK8_52","LK9_3","LK9_4","LK9_5","LK9_13","LK9_14","LK9_27","LK9_35","LK9_41","LK9_44","LK9_48","LK9_50","LK10_2","LK10_3","LK10_4","LK10_5","LK10_6","LK10_7","LK10_8","LK10_9","LK10_10","LK10_11","LK10_12","LK10_13","LK10_14","LK10_16","LK10_20","LK10_23","LK10_24","LK11_2","LK11_5","LK11_8","LK11_9","LK11_10","LK11_11","LK11_13","LK11_19","LK11_20","LK11_39","LK11_42","LK11_43","LK11_44","LK11_46","LK11_47","LK11_48","LK11_49","LK11_51","LK11_52","LK12_1","LK12_4","LK12_5","LK12_6","LK12_7","LK12_8","LK12_11","LK12_12","LK12_14","LK12_15","LK12_22","LK12_24","LK12_25","LK12_26","LK12_27","LK12_28","LK12_29","LK12_30","LK12_31","LK12_32","LK12_33","LK12_34","LK12_35","LK12_36","LK12_37","LK12_39","LK12_40","LK12_44","LK12_51","LK12_54","LK12_55","LK12_56","LK12_57","LK13_2","LK13_3","LK13_4","LK13_5","LK13_15","LK13_24","LK13_25","LK13_26","LK13_27","LK13_28","LK13_32","LK13_34","LK13_35","LK14_17","LK14_24","LK14_33","LK15_4","LK15_6","LK15_7","LK15_9","LK15_10","LK16_9","LK16_11","LK16_12","LK16_13","LK16_15","LK17_1","LK17_3","LK17_4","LK17_6","LK17_7","LK17_10","LK17_14","LK17_21","LK17_22","LK17_23","LK18_6","LK18_8","LK18_14","LK18_16","LK18_17","LK18_29","LK19_13","LK19_30","LK19_31","LK19_46","LK20_3","LK20_8","LK20_23","LK20_24","LK20_25","LK21_3","LK21_4","LK21_8","LK21_9","LK21_12","LK21_13","LK21_14","LK21_15","LK21_17","LK21_18","LK21_19","LK21_20","LK21_28","LK21_29","LK21_30","LK21_31","LK21_32","LK21_34","LK21_36","LK22_10","LK22_11","LK22_12","LK22_15","LK22_17","LK22_19","LK22_20","LK22_26","LK22_27","LK22_28","LK22_29","LK22_30","LK22_35","LK22_36","LK22_38","LK22_40","LK22_46","LK22_51","LK22_52","LK22_53","LK22_67","LK22_68","LK22_70","LK23_14","LK23_15","LK23_22","LK23_28","LK24_5","LK24_6","LK24_17","LK24_36","LK24_38","LK24_39","LK24_41","LK24_44","LK24_48","LK24_49",
    "JN1_26","JN1_38","JN1_39","JN1_51","JN2_5","JN2_7","JN2_8","JN2_16","JN2_19","JN3_7","JN3_11","JN3_12","JN3_28","JN4_20","JN4_21","JN4_22","JN4_32","JN4_35","JN4_38","JN4_48","JN5_20","JN5_28","JN5_33","JN5_34","JN5_38","JN5_39","JN5_40","JN5_42","JN5_44","JN5_45","JN5_47","JN6_10","JN6_12","JN6_20","JN6_26","JN6_27","JN6_29","JN6_32","JN6_36","JN6_43","JN6_53","JN6_61","JN6_62","JN6_64","JN6_65","JN6_67","JN6_70","JN7_6","JN7_7","JN7_8","JN7_19","JN7_21","JN7_22","JN7_23","JN7_24","JN7_28","JN7_33","JN7_34","JN7_36","JN7_47","JN8_13","JN8_14","JN8_15","JN8_19","JN8_21","JN8_22","JN8_23","JN8_24","JN8_25","JN8_28","JN8_31","JN8_32","JN8_33","JN8_34","JN8_36","JN8_37","JN8_38","JN8_39","JN8_40","JN8_41","JN8_42","JN8_43","JN8_44","JN8_45","JN8_46","JN8_47","JN8_49","JN8_51","JN8_54","JN8_55","JN8_56","JN8_58","JN9_19","JN9_21","JN9_23","JN9_27","JN9_30","JN9_41","JN10_1","JN10_7","JN10_25","JN10_26","JN10_32","JN10_34","JN10_35","JN10_36","JN10_38","JN11_15","JN11_34","JN11_39","JN11_44","JN12_8","JN12_24","JN12_30","JN12_35","JN12_36","JN13_10","JN13_12","JN13_13","JN13_14","JN13_15","JN13_17","JN13_18","JN13_19","JN13_33","JN13_34","JN13_35","JN14_1","JN14_3","JN14_4","JN14_7","JN14_9","JN14_10","JN14_11","JN14_12","JN14_13","JN14_14","JN14_15","JN14_16","JN14_17","JN14_19","JN14_20","JN14_24","JN14_25","JN14_26","JN14_27","JN14_28","JN14_29","JN14_31","JN15_2","JN15_3","JN15_4","JN15_5","JN15_7","JN15_8","JN15_9","JN15_10","JN15_11","JN15_12","JN15_14","JN15_15","JN15_16","JN15_17","JN15_18","JN15_19","JN15_20","JN15_21","JN15_26","JN15_27","JN16_1","JN16_2","JN16_3","JN16_4","JN16_5","JN16_6","JN16_7","JN16_10","JN16_12","JN16_13","JN16_14","JN16_16","JN16_17","JN16_19","JN16_20","JN16_22","JN16_23","JN16_24","JN16_25","JN16_26","JN16_27","JN16_31","JN16_32","JN16_33","JN17_14","JN18_7","JN18_8","JN18_31","JN18_39","JN19_4","JN19_5","JN19_6","JN19_14","JN19_15","JN20_17","JN20_19","JN20_21","JN20_22","JN20_26","JN21_5","JN21_6","JN21_12",
    "AC1_4","AC1_5","AC1_7","AC1_8","AC1_11","AC2_14","AC2_15","AC2_17","AC2_22","AC2_29","AC2_33","AC2_36","AC2_38","AC2_39","AC3_13","AC3_14","AC3_15","AC3_16","AC3_17","AC3_19","AC3_22","AC3_25","AC3_26","AC4_7","AC4_10","AC4_11","AC4_19","AC5_8","AC5_9","AC5_20","AC5_28","AC5_30","AC5_35","AC5_38","AC5_39","AC6_3","AC7_2","AC7_4","AC7_26","AC7_37","AC7_42","AC7_43","AC7_51","AC7_52","AC7_53","AC8_19","AC8_24","AC10_28","AC10_29","AC10_37","AC11_14","AC11_16","AC13_15","AC13_16","AC13_25","AC13_26","AC13_32","AC13_33","AC13_38","AC13_39","AC13_40","AC13_41","AC13_46","AC14_15","AC15_7","AC15_10","AC15_24","AC15_25","AC15_28","AC15_29","AC16_36","AC17_3","AC17_22","AC17_23","AC17_28","AC17_30","AC17_31","AC19_2","AC19_13","AC19_15","AC19_25","AC19_36","AC19_37","AC20_18","AC20_20","AC20_25","AC20_26","AC20_27","AC20_28","AC20_29","AC20_30","AC20_31","AC20_32","AC20_35","AC21_13","AC22_1","AC22_3","AC22_25","AC23_5","AC23_15","AC24_21","AC24_22","AC25_24","AC25_26","AC26_3","AC26_8","AC26_14","AC27_22","AC27_25","AC27_26","AC27_31","AC27_33","AC27_34","AC28_20","AC28_25","AC28_28",
    "RO1_6","RO1_7","RO1_8","RO1_10","RO1_11","RO1_12","RO1_13","RO1_15","RO2_24","RO6_3","RO6_11","RO6_12","RO6_13","RO6_14","RO6_16","RO6_17","RO6_18","RO6_19","RO6_22","RO7_1","RO7_4","RO8_9","RO8_11","RO8_13","RO10_1","RO11_2","RO11_13","RO11_25","RO11_28","RO11_30","RO11_31","RO12_1","RO12_2","RO12_14","RO12_16","RO12_18","RO13_11","RO14_1","RO15_5","RO15_6","RO15_7","RO15_13","RO15_14","RO15_15","RO15_22","RO15_23","RO15_24","RO15_28","RO15_29","RO15_30","RO15_32","RO15_33","RO16_1","RO16_2","RO16_3","RO16_5","RO16_6","RO16_7","RO16_8","RO16_9","RO16_10","RO16_11","RO16_12","RO16_13","RO16_14","RO16_15","RO16_16","RO16_17","RO16_19","RO16_20",
    "1C1_10","1C1_11","1C1_26","1C2_1","1C2_2","1C3_1","1C3_2","1C3_3","1C3_4","1C3_9","1C3_16","1C3_17","1C3_21","1C3_22","1C3_23","1C4_6","1C4_8","1C4_14","1C4_15","1C4_16","1C4_17","1C4_18","1C4_21","1C5_2","1C5_6","1C5_7","1C5_12","1C5_13","1C6_1","1C6_2","1C6_3","1C6_4","1C6_5","1C6_6","1C6_7","1C6_8","1C6_9","1C6_11","1C6_15","1C6_19","1C6_20","1C7_5","1C7_23","1C7_24","1C7_35","1C8_9","1C8_12","1C9_1","1C9_2","1C9_11","1C9_13","1C9_24","1C10_1","1C10_7","1C10_8","1C10_9","1C10_10","1C10_13","1C10_14","1C10_15","1C10_18","1C10_20","1C10_21","1C10_31","1C10_32","1C11_1","1C11_2","1C11_13","1C11_14","1C11_17","1C11_18","1C11_19","1C11_20","1C11_22","1C11_24","1C11_25","1C11_26","1C11_30","1C11_33","1C11_34","1C12_1","1C12_27","1C12_31","1C14_1","1C14_5","1C14_6","1C14_9","1C14_12","1C14_18","1C14_20","1C14_23","1C14_26","1C14_29","1C14_31","1C14_33","1C14_36","1C14_37","1C14_39","1C15_1","1C15_2","1C15_3","1C15_11","1C15_33","1C15_34","1C15_51","1C15_58","1C16_1","1C16_2","1C16_10","1C16_11","1C16_12","1C16_13","1C16_14","1C16_15","1C16_16","1C16_17","1C16_18","1C16_19","1C16_20","1C16_23","1C16_24",
    "2C1_6","2C1_7","2C1_8","2C1_11","2C1_13","2C1_14","2C1_23","2C1_24","2C2_1","2C2_3","2C2_4","2C2_5","2C2_7","2C2_8","2C2_9","2C2_10","2C3_2","2C3_3","2C4_5","2C4_12","2C4_14","2C4_15","2C5_11","2C5_12","2C5_13","2C5_20","2C6_1","2C6_11","2C6_12","2C6_13","2C6_14","2C6_16","2C6_17","2C6_18","2C7_1","2C7_2","2C7_3","2C7_4","2C7_7","2C7_8","2C7_9","2C7_11","2C7_12","2C7_13","2C7_14","2C7_15","2C7_16","2C8_1","2C8_6","2C8_7","2C8_8","2C8_9","2C8_10","2C8_11","2C8_14","2C8_17","2C8_22","2C8_23","2C8_24","2C9_1","2C9_2","2C9_3","2C9_4","2C9_5","2C9_8","2C9_10","2C9_11","2C9_13","2C9_14","2C10_1","2C10_2","2C10_6","2C10_7","2C10_8","2C10_11","2C10_13","2C10_14","2C10_15","2C11_1","2C11_2","2C11_3","2C11_4","2C11_6","2C11_7","2C11_8","2C11_9","2C11_11","2C11_16","2C11_19","2C11_20","2C12_11","2C12_13","2C12_14","2C12_15","2C12_17","2C12_18","2C12_19","2C12_20","2C12_21","2C13_1","2C13_2","2C13_3","2C13_5","2C13_7","2C13_9","2C13_11","2C13_12","2C13_14",
    "GA1_3","GA1_6","GA1_7","GA1_8","GA1_9","GA1_11","GA1_13","GA1_20","GA2_5","GA3_1","GA3_2","GA3_3","GA3_4","GA3_5","GA3_7","GA3_26","GA3_27","GA3_28","GA3_29","GA4_6","GA4_7","GA4_8","GA4_9","GA4_11","GA4_12","GA4_13","GA4_14","GA4_15","GA4_16","GA4_17","GA4_18","GA4_19","GA4_20","GA4_21","GA4_28","GA4_31","GA5_1","GA5_2","GA5_4","GA5_7","GA5_8","GA5_10","GA5_12","GA5_13","GA5_15","GA5_16","GA5_17","GA5_18","GA5_21","GA5_25","GA5_26","GA6_1","GA6_2","GA6_7","GA6_11","GA6_12","GA6_13","GA6_18",
    "EP1_2","EP1_3","EP1_13","EP1_15","EP1_17","EP1_18","EP2_1","EP2_2","EP2_4","EP2_5","EP2_6","EP2_8","EP2_10","EP2_11","EP2_12","EP2_13","EP2_14","EP2_17","EP2_19","EP2_20","EP2_22","EP3_1","EP3_2","EP3_4","EP3_13","EP3_16","EP3_17","EP3_18","EP3_19","EP4_1","EP4_4","EP4_17","EP4_20","EP4_21","EP4_22","EP4_23","EP4_24","EP4_25","EP4_26","EP4_27","EP4_29","EP4_30","EP4_31","EP4_32","EP5_1","EP5_2","EP5_3","EP5_4","EP5_5","EP5_6","EP5_7","EP5_8","EP5_11","EP5_15","EP5_17","EP5_18","EP5_19","EP5_20","EP5_21","EP5_33","EP6_1","EP6_4","EP6_5","EP6_6","EP6_9","EP6_10","EP6_11","EP6_12","EP6_13","EP6_14","EP6_16","EP6_17","EP6_18","EP6_21","EP6_22","EP6_23","EP6_24",
    "PP1_2","PP1_6","PP1_7","PP1_8","PP1_9","PP1_10","PP1_12","PP1_25","PP1_26","PP1_27","PP1_28","PP1_29","PP1_30","PP2_2","PP2_5","PP2_12","PP2_13","PP2_14","PP2_15","PP2_16","PP2_17","PP2_18","PP2_19","PP2_22","PP2_25","PP2_26","PP2_28","PP2_29","PP2_30","PP3_1","PP3_2","PP3_15","PP3_16","PP3_17","PP4_1","PP4_2","PP4_4","PP4_5","PP4_6","PP4_7","PP4_8","PP4_9","PP4_12","PP4_13","PP4_15","PP4_16","PP4_18","PP4_19","PP4_21","PP4_22","PP4_23",
    "CL1_2","CL1_3","CL1_4","CL1_5","CL1_6","CL1_7","CL1_8","CL1_9","CL1_12","CL1_21","CL1_22","CL1_23","CL1_24","CL1_25","CL1_27","CL2_1","CL2_4","CL2_5","CL2_6","CL2_7","CL2_8","CL2_10","CL2_11","CL2_12","CL2_13","CL2_16","CL2_18","CL2_20","CL3_1","CL3_2","CL3_3","CL3_4","CL3_5","CL3_7","CL3_8","CL3_9","CL3_12","CL3_13","CL3_14","CL3_15","CL3_16","CL3_17","CL3_18","CL3_19","CL3_20","CL3_21","CL3_22","CL3_23","CL3_24","CL4_1","CL4_2","CL4_3","CL4_5","CL4_6","CL4_7","CL4_8","CL4_9","CL4_10","CL4_12","CL4_15","CL4_16","CL4_17","CL4_18",
    "1TS1_2","1TS1_3","1TS1_4","1TS1_5","1TS1_6","1TS1_7","1TS1_8","1TS2_1","1TS2_2","1TS2_5","1TS2_6","1TS2_7","1TS2_8","1TS2_9","1TS2_10","1TS2_11","1TS2_12","1TS2_13","1TS2_14","1TS2_17","1TS2_18","1TS2_19","1TS2_20","1TS3_2","1TS3_3","1TS3_4","1TS3_5","1TS3_6","1TS3_7","1TS3_8","1TS3_9","1TS3_10","1TS3_11","1TS3_12","1TS3_13","1TS4_1","1TS4_2","1TS4_6","1TS4_7","1TS4_8","1TS4_9","1TS4_10","1TS4_11","1TS4_13","1TS4_15","1TS4_18","1TS5_1","1TS5_2","1TS5_4","1TS5_5","1TS5_6","1TS5_11","1TS5_12","1TS5_13","1TS5_14","1TS5_15","1TS5_16","1TS5_18","1TS5_23","1TS5_25","1TS5_26","1TS5_27","1TS5_28",
    "2TS1_3","2TS1_4","2TS1_5","2TS1_7","2TS1_10","2TS1_11","2TS1_12","2TS2_1","2TS2_2","2TS2_3","2TS2_5","2TS2_6","2TS2_10","2TS2_13","2TS2_14","2TS2_15","2TS2_17","2TS3_1","2TS3_3","2TS3_4","2TS3_6","2TS3_7","2TS3_9","2TS3_10","2TS3_12","2TS3_13","2TS3_14","2TS3_15","2TS3_16","2TS3_17","2TS3_18",
    "HB2_1","HB2_3","HB3_1","HB3_7","HB3_8","HB3_12","HB3_13","HB3_15","HB4_1","HB4_7","HB4_11","HB4_14","HB4_16","HB5_11","HB5_12","HB6_1","HB6_9","HB6_10","HB6_11","HB6_12","HB6_18","HB7_4","HB10_19","HB10_22","HB10_23","HB10_24","HB10_25","HB10_32","HB10_34","HB10_35","HB10_36","HB12_1","HB12_3","HB12_4","HB12_5","HB12_7","HB12_12","HB12_13","HB12_14","HB12_15","HB12_16","HB12_18","HB12_22","HB12_25","HB12_28","HB13_2","HB13_3","HB13_4","HB13_5","HB13_7","HB13_9","HB13_16","HB13_17","HB13_18","HB13_19","HB13_20","HB13_21","HB13_22","HB13_23","HB13_24","HB13_25",
    "JM1_2","JM1_5","JM1_16","JM1_19","JM1_21","JM1_22","JM2_1","JM2_5","JM2_6","JM2_12","JM3_1","JM3_14","JM4_1","JM4_2","JM4_3","JM4_4","JM4_5","JM4_7","JM4_8","JM4_9","JM4_10","JM4_11","JM5_1","JM5_2","JM5_3","JM5_4","JM5_5","JM5_6","JM5_7","JM5_8","JM5_9","JM5_10","JM5_12","JM5_13","JM5_14","JM5_16","JM5_19","JM5_20",
    "1P1_2","1P1_3","1P1_4","1P1_6","1P1_7","1P1_8","1P1_9","1P1_10","1P1_12","1P1_13","1P1_14","1P1_15","1P1_17","1P1_18","1P1_21","1P1_22","1P1_23","1P1_25","1P2_2","1P2_5","1P2_7","1P2_9","1P2_10","1P2_11","1P2_12","1P2_13","1P2_14","1P2_15","1P2_16","1P2_17","1P2_18","1P2_21","1P2_24","1P2_25","1P3_1","1P3_6","1P3_7","1P3_8","1P3_9","1P3_13","1P3_14","1P3_15","1P3_16","1P3_21","1P4_1","1P4_7","1P4_8","1P4_9","1P4_10","1P4_11","1P4_12","1P4_13","1P4_14","1P4_15","1P4_16","1P4_19","1P5_1","1P5_2","1P5_5","1P5_6","1P5_7","1P5_8","1P5_9","1P5_10","1P5_12","1P5_13","1P5_14",
    "2P1_2","2P1_5","2P1_8","2P1_10","2P1_12","2P1_13","2P1_15","2P1_16","2P1_19","2P3_1","2P3_2","2P3_8","2P3_11","2P3_14","2P3_15","2P3_17","2P3_18",
    "1J1_2","1J1_3","1J1_4","1J1_5","1J2_1","1J2_7","1J2_8","1J2_12","1J2_13","1J2_14","1J2_18","1J2_19","1J2_20","1J2_21","1J2_24","1J2_25","1J2_26","1J2_27","1J2_28","1J3_1","1J3_2","1J3_5","1J3_7","1J3_13","1J3_21","1J4_1","1J4_4","1J4_14","1J5_13",
    "2J1_5","2J1_6","2J1_8","2J1_10","2J1_12",
    "3J1_4",
    "JD1_3","JD1_5","JD1_12","JD1_17","JD1_18","JD1_20","JD1_21","JD1_24",
    "RV1_4","RV1_9","RV2_10","RV2_13","RV2_23","RV2_24","RV2_25","RV18_4","RV18_6","RV18_20","RV22_16"
  ]
};

/**
 * Create an Eng2p plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export const Eng2pPlugin = (app) => {
  const config = getConfig();

  if (!config.enableEng2pPlugin) {
    return {};
  }

  const engWindow = MovableWindow(550, 290);

  let optionsHtml = '';
  if (config.eng2pEnableAll === true) {
    optionsHtml = `
      <tr>
        <th>
          <input type="radio" name="eng2p-option" id="eng2p-option-youall" value="youall" />
          <label for="eng2p-option-youall">General US</label>
        </th>
        <td>You all</td>
        <td>You all's</td>
        <td>You all's</td>
        <td>You allselves</td>
      </tr>
      <tr>
        <th>
          <input type="radio" name="eng2p-option" id="eng2p-option-yall" value="yall" />
          <label for="eng2p-option-yall">Southern US</label>
        </th>
        <td>Y'all</td>
        <td>Y'all's</td>
        <td>Y'all's</td>
        <td>Y'allselves</td>
      </tr>
      <tr>
        <th>
          <input type="radio" name="eng2p-option" id="eng2p-option-youguys" value="youguys" />
          <label for="eng2p-option-youguys">Western US</label>
        </th>
        <td>You guys</td>
        <td>Your guys's</td>
        <td>Your guys's</td>
        <td>Your guys selves</td>
      </tr>
      <tr>
        <th>
          <input type="radio" name="eng2p-option" id="eng2p-option-youseguys" value="youseguys" />
          <label for="eng2p-option-youseguys">NYC/Chicago</label>
        </th>
        <td>Youse guys</td>
        <td>Youse guys's</td>
        <td>Youse guys's</td>
        <td>Youse guys selves</td>
      </tr>
      <tr>
        <th>
          <input type="radio" name="eng2p-option" id="eng2p-option-yinz" value="yinz" />
          <label for="eng2p-option-yinz">Pittsburgh</label>
        </th>
        <td>Yinz</td>
        <td>Yinz's</td>
        <td>Yinz's</td>
        <td>Yinzselves</td>
      </tr>
      <tr>
        <th>
          <input type="radio" name="eng2p-option" id="eng2p-option-youlot" value="youlot" />
          <label for="eng2p-option-youlot">United Kingdom</label>
        </th>
        <td>You lot</td>
        <td>You lot's</td>
        <td>You lot's</td>
        <td>Yourlot's</td>
      </tr>
      <tr>
        <th>
          <input type="radio" name="eng2p-option" id="eng2p-option-ye" value="ye" />
          <label for="eng2p-option-ye">Old English</label>
        </th>
        <td>Ye</td>
        <td>Ye's</td>
        <td>Ye's</td>
        <td>Yeselves</td>
      </tr>`;
  }

  const configBlock = elem('div', { className: 'config-options', id: 'config-eng2p' });
  configBlock.innerHTML = `
    <p class="i18n" data-i18n="[html]plugins.eng2p.description"></p>
    <table>
      <tbody>
        <tr>
          <th>
            <input type="radio" name="eng2p-option" id="eng2p-option-none" value="none" />
            <label for="eng2p-option-none">None</label>
          </th>
          <td>You</td>
          <td>Your</td>
          <td>Yours</td>
          <td>Yourselves</td>
        </tr>
        <tr>
          <th>
            <input type="radio" name="eng2p-option" id="eng2p-option-highlight" value="highlight" />
            <label for="eng2p-option-highlight">Highlight</label>
          </th>
          <td><span class="eng2p-highlight-demo">You</span></td>
          <td><span class="eng2p-highlight-demo">Your</span></td>
          <td><span class="eng2p-highlight-demo">Yours</span></td>
          <td><span class="eng2p-highlight-demo">Yourselves</span></td>
        </tr>
        ${optionsHtml}
      </tbody>
    </table>
  `;

  const engWindowBody = engWindow.body;
  engWindowBody.appendChild(configBlock);

  const configToolsBody = document.querySelector('#config-tools .config-body');
  const button = elem('span', { className: 'config-button i18n', id: 'config-eng2p-button' });
  button.setAttribute('data-i18n', '[html]plugins.eng2p.title');

  if (configToolsBody) {
    configToolsBody.appendChild(button);
  }

  const engWindowTitle = engWindow.title;
  engWindowTitle.classList.add('i18n');
  engWindowTitle.setAttribute('data-i18n', '[html]plugins.eng2p.title');

  button.addEventListener('click', () => {
    // Close the config popover first
    const configWindow = document.getElementById('config-window');
    if (configWindow?.matches(':popover-open')) {
      configWindow.hidePopover();
    }

    engWindow.show().center();
  });

  // SET DEFAULT
  // setting from localStorage
  let eng2pSetting = AppSettings.getValue('docs-config-eng2p-setting', { eng2p: config.eng2pDefaultSetting });

  // override with querystring
  const params = Object.fromEntries(new URLSearchParams(window.location.search));

  // if it's in the querystring, try to use it
  if (params['eng2p'] !== undefined) {
    const tempEng2pSetting = params['eng2p'];

    // see if there is a matching value
    if (document.getElementById(`eng2p-option-${tempEng2pSetting}`)) {
      eng2pSetting.eng2p = tempEng2pSetting;
    }
  }

  if (params['eng2pshow'] !== undefined || config.eng2pShowWindowAtStartup === true) {
    engWindow.show();
    const engWindowContainer = engWindow.container;
    engWindowContainer.style.left = `${window.innerWidth - engWindowContainer.offsetWidth - 10}px`;
  }

  // Define helper functions before they are used
  const getPluralValues = () => {
    const selectedOption = document.getElementById(`eng2p-option-${eng2pSetting.eng2p}`);
    const selectedRow = selectedOption ? selectedOption.closest('tr') : null;

    if (selectedRow) {
      const tds = selectedRow.querySelectorAll('td');
      eng2p.youPluralSubject = tds[0]?.innerHTML ?? '';
      eng2p.youPluralPossessiveDeterminer = tds[1]?.innerHTML ?? '';
      eng2p.youPluralPossessivePronoun = tds[2]?.innerHTML ?? '';
      eng2p.youPluralReflexive = tds[3]?.innerHTML ?? '';
    }
  };

  const removePluralTransforms = (node) => {
    eng2p.removePluralTransforms(node);
  };

  const runPluralTransforms = (node) => {
    const nodeEl = node;
    nodeEl.querySelectorAll('.verse, .v').forEach((verse) => {
      const verseid = verse.getAttribute('data-id');

      if (eng2p.secondPersonPlurals.indexOf(verseid) > -1) {
        // Add the eng2p-verbs class to mark this verse
        verse.classList.add('eng2p-verbs');

        let html = verse.innerHTML;

        if (eng2pSetting.eng2p === 'highlight') {
          html = eng2p.highlightPlurals(html);
        } else if (eng2pSetting.eng2p !== 'none') {
          html = eng2p.replacePlurals(html);
        }

        verse.innerHTML = html;
      }
    });
  };

  // now set the value from either localStorage or querystring
  const optionInput = document.getElementById(`eng2p-option-${eng2pSetting.eng2p}`);
  if (optionInput) {
    optionInput.checked = true;
  }
  getPluralValues();

  // create updates
  document.querySelectorAll('input[name="eng2p-option"]').forEach((input) => {
    input.addEventListener('click', function() {
      // update the setting value
      eng2pSetting = { eng2p: this.value };

      // store value
      AppSettings.setValue('docs-config-eng2p-setting', eng2pSetting);

      // values
      getPluralValues();

      // re-run on all English chapters
      document.querySelectorAll('div.chapter[lang]').forEach((chapter) => {
        const lang = (chapter.getAttribute('lang') || '').toLowerCase();
        const isEnglish = lang === 'en' || lang === 'eng' ||
                          lang.startsWith('en-') || lang.startsWith('eng-');
        if (isEnglish) {
          removePluralTransforms(chapter);
          runPluralTransforms(chapter);
        }
      });
    });
  });

  // run transforms
  let ext = {
    sendMessage() {}
  };

  mixinEventEmitter(ext);

  ext.on('message', (e) => {
    if (e.data.messagetype === 'textload' && e.data.type === 'bible') {
      const contentEl = e.data.content;
      if (!contentEl || eng2pSetting.eng2p === 'none') return;

      // Helper to check if a lang attribute indicates English
      const isEnglishLang = (lang) => {
        if (!lang) return false;
        const lowerLang = lang.toLowerCase();
        return lowerLang === 'en' || lowerLang === 'eng' ||
               lowerLang.startsWith('en-') || lowerLang.startsWith('eng-');
      };

      // Check if content element itself is an English chapter
      const contentLang = contentEl.getAttribute('lang') || '';
      if (isEnglishLang(contentLang) && contentEl.classList.contains('chapter')) {
        runPluralTransforms(contentEl);
      }

      // Also find all chapters within the content and check their lang
      contentEl.querySelectorAll('div.chapter[lang]').forEach((chapter) => {
        const chapterLang = chapter.getAttribute('lang') || '';
        if (isEnglishLang(chapterLang)) {
          runPluralTransforms(chapter);
        }
      });
    }
  });

  return ext;
};

// Export eng2p data for external use
export { eng2p };

export default Eng2pPlugin;
