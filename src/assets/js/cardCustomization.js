import { normalizeArtworkDisplay } from "./artworkDisplay.js";
import { normalizeHeaderSettings, resolveHeaderSettings } from "./headerSettings.js";
import {
  getImageRotation,
  getPlatformArtworkDisplay,
  getPlatformColor,
  getPlatformHeaderSettings,
  normalizeRotationDegrees,
} from "./platformDefaults.js";

/** @typedef {import('./headerSettings.js').HeaderSettings} HeaderSettings */
/** @typedef {import('./artworkDisplay.js').ArtworkDisplaySettings} ArtworkDisplaySettings */
/** @typedef {import('./platformDefaults.js').PlatformDefaults} PlatformDefaults */
/** @typedef {import('./state.js').Card} Card */

export const CUSTOMIZATION_DEFAULT = "default";
export const CUSTOMIZATION_CUSTOMIZED = "customized";

/**
 * @param {Card} card
 * @param {Record<string, PlatformDefaults>} platformDefaults
 * @returns {HeaderSettings}
 */
export function resolveCardHeaderSettings(card, platformDefaults) {
  if (card.customization === CUSTOMIZATION_CUSTOMIZED && card.headerSettings) {
    return resolveHeaderSettings(card.headerSettings);
  }
  return resolveHeaderSettings(getPlatformHeaderSettings(platformDefaults, card.platformId));
}

/**
 * @param {ArtworkDisplaySettings} left
 * @param {ArtworkDisplaySettings} right
 */
export function artworkDisplayEqual(left, right) {
  const a = normalizeArtworkDisplay(left);
  const b = normalizeArtworkDisplay(right);
  return (
    a.alignment === b.alignment &&
    a.backgroundMode === b.backgroundMode &&
    a.backgroundColor === b.backgroundColor &&
    a.zoom === b.zoom
  );
}

/**
 * @param {HeaderSettings} left
 * @param {HeaderSettings} right
 */
export function headerSettingsEqual(left, right) {
  const a = normalizeHeaderSettings(left);
  const b = normalizeHeaderSettings(right);
  return (
    a.showHeader === b.showHeader &&
    a.showPlatformColor === b.showPlatformColor &&
    a.headerHeightPercent === b.headerHeightPercent
  );
}

/**
 * @param {{
 *   game: { platformId: string },
 *   imageType: string,
 *   colorOverride?: string | null,
 *   artworkDisplayOverride?: ArtworkDisplaySettings | null,
 *   imageRotation?: number,
 *   headerSettingsOverride?: HeaderSettings | null,
 * }} browseState
 * @param {Record<string, PlatformDefaults>} platformDefaults
 */
export function getBrowseSessionEffectiveValues(browseState, platformDefaults) {
  const platformId = browseState.game.platformId;
  const platformEntry = platformDefaults[platformId];
  const platformArtwork = getPlatformArtworkDisplay(platformDefaults, platformId);
  const platformHeader = getPlatformHeaderSettings(platformDefaults, platformId);

  return {
    color: browseState.colorOverride ?? getPlatformColor(platformDefaults, platformId),
    artworkDisplay: browseState.artworkDisplayOverride
      ? normalizeArtworkDisplay({ ...platformArtwork, ...browseState.artworkDisplayOverride })
      : platformArtwork,
    imageRotation: normalizeRotationDegrees(browseState.imageRotation ?? 0),
    platformImageRotation: getImageRotation(platformDefaults, platformId, browseState.imageType),
    headerSettings: browseState.headerSettingsOverride
      ? normalizeHeaderSettings({
          ...platformHeader,
          ...browseState.headerSettingsOverride,
        })
      : platformHeader,
  };
}

/**
 * @param {Parameters<typeof getBrowseSessionEffectiveValues>[0]} browseState
 * @param {Record<string, PlatformDefaults>} platformDefaults
 */
export function browseSessionMatchesPlatformDefaults(browseState, platformDefaults) {
  const platformId = browseState.game.platformId;
  const effective = getBrowseSessionEffectiveValues(browseState, platformDefaults);
  const platformEntry = platformDefaults[platformId];
  if (!platformEntry) return true;

  if (effective.color !== getPlatformColor(platformDefaults, platformId)) return false;
  if (!artworkDisplayEqual(effective.artworkDisplay, getPlatformArtworkDisplay(platformDefaults, platformId))) {
    return false;
  }
  if (effective.imageRotation !== 0) return false;
  if (!headerSettingsEqual(effective.headerSettings, getPlatformHeaderSettings(platformDefaults, platformId))) {
    return false;
  }
  return true;
}

/**
 * @param {Parameters<typeof getBrowseSessionEffectiveValues>[0]} browseState
 * @param {Record<string, PlatformDefaults>} platformDefaults
 */
export function browseSessionIsCustomized(browseState, platformDefaults) {
  return !browseSessionMatchesPlatformDefaults(browseState, platformDefaults);
}

/**
 * @param {Card} card
 * @param {Record<string, PlatformDefaults>} platformDefaults
 */
export function inferCardCustomization(card, platformDefaults) {
  if (card.customization === CUSTOMIZATION_DEFAULT || card.customization === CUSTOMIZATION_CUSTOMIZED) {
    return card.customization;
  }

  const platformId = card.platformId;
  if (card.artworkDisplay) {
    const platformArtwork = getPlatformArtworkDisplay(platformDefaults, platformId);
    if (!artworkDisplayEqual(card.artworkDisplay, platformArtwork)) {
      return CUSTOMIZATION_CUSTOMIZED;
    }
  }

  if (normalizeRotationDegrees(card.imageRotation ?? 0) !== 0) {
    return CUSTOMIZATION_CUSTOMIZED;
  }

  if (card.headerSettings) {
    const platformHeader = getPlatformHeaderSettings(platformDefaults, platformId);
    if (!headerSettingsEqual(card.headerSettings, platformHeader)) {
      return CUSTOMIZATION_CUSTOMIZED;
    }
  }

  return CUSTOMIZATION_DEFAULT;
}

/**
 * @param {Card} card
 * @returns {Card}
 */
export function toDefaultCardShape(card) {
  const { artworkDisplay: _a, imageRotation: _r, headerSettings: _h, ...rest } = card;
  return {
    ...rest,
    customization: CUSTOMIZATION_DEFAULT,
  };
}

/**
 * @param {Card} card
 * @param {Record<string, PlatformDefaults>} platformDefaults
 * @returns {Card}
 */
export function normalizeCardCustomization(card, platformDefaults) {
  const customization = inferCardCustomization(card, platformDefaults);
  if (customization === CUSTOMIZATION_DEFAULT) {
    return toDefaultCardShape(card);
  }
  return {
    ...card,
    customization: CUSTOMIZATION_CUSTOMIZED,
    ...(card.artworkDisplay ? { artworkDisplay: normalizeArtworkDisplay(card.artworkDisplay) } : {}),
    ...(normalizeRotationDegrees(card.imageRotation ?? 0)
      ? { imageRotation: normalizeRotationDegrees(card.imageRotation ?? 0) }
      : {}),
    ...(card.headerSettings ? { headerSettings: normalizeHeaderSettings(card.headerSettings) } : {}),
  };
}

/**
 * @param {Card[]} collection
 * @param {string} platformId
 * @param {Record<string, PlatformDefaults>} platformDefaults
 */
export function countDefaultCardsOnPlatform(collection, platformId, platformDefaults) {
  return collection.filter(
    (card) =>
      card.platformId === platformId &&
      inferCardCustomization(card, platformDefaults) === CUSTOMIZATION_DEFAULT,
  ).length;
}
