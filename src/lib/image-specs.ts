// Recommended upload sizes and preview aspect ratios, in one place.
//
// These used to be string literals typed into each ImageUpload call site, and
// they drifted: the campaign page's v2 layout renders reward covers portrait at
// 2:3, but the builder went on recommending 933 x 621 — a 3:2 landscape frame.
// With object-cover, a landscape upload in a portrait card loses its sides.
//
// The rule for anything added here: the aspect a creator uploads against must
// be the aspect the image is actually rendered at. If those two ever disagree,
// the creator's artwork gets cropped somewhere they can't see it happening.

export interface ImageSpec {
  /** Tailwind aspect class for the upload preview — must match the render. */
  aspect: string;
  /** Human-readable recommendation shown under the dropzone. */
  label: string;
}

/** Campaign hero / listing card. Rendered aspect-video on both layouts. */
export const PROJECT_COVER_SPEC: ImageSpec = {
  aspect: "aspect-video",
  label: "1024 x 576 px (16:9)",
};

/**
 * Reward and add-on artwork, layout v1.
 * campaign-tab.tsx renders these at aspect-[3/2] in the right rail.
 */
export const REWARD_SPEC_V1: ImageSpec = {
  aspect: "aspect-[3/2]",
  label: "933 x 621 px (3:2 landscape)",
};

/**
 * Reward and add-on artwork, layout v2.
 * campaign-tab-v2.tsx renders these at aspect-[2/3] in the reward grid —
 * portrait, because on a comics platform the artwork is a cover, not a banner.
 *
 * 1000 x 1500 covers the largest case at 2x: a single-column phone card can
 * reach ~430 CSS px wide, and standard comic trim (6.625 x 10.25 in) is close
 * enough to 2:3 that a cover scan drops in without cropping.
 */
export const REWARD_SPEC_V2: ImageSpec = {
  aspect: "aspect-[2/3]",
  label: "1000 x 1500 px (2:3 portrait)",
};

/**
 * Individual items inside a reward.
 *
 * Square, because square is the only shape these are ever displayed in: the
 * IndieKit survey renders them at 80 x 80. The old 933 x 621 recommendation
 * described no surface in the product — an item image uploaded at 3:2 has
 * always been centre-cropped to a square the moment a backer saw it.
 */
export const ITEM_SPEC: ImageSpec = {
  aspect: "aspect-square",
  label: "800 x 800 px (square)",
};

/** Creator avatar. */
export const AVATAR_SPEC: ImageSpec = {
  aspect: "aspect-square",
  label: "400 x 400 px",
};

/**
 * Reward artwork spec for a given campaign layout.
 *
 * Defaults to v2 when the version is unknown: a brand-new campaign has no
 * persisted layoutVersion yet and the schema default for new projects is 2.
 */
export function rewardImageSpec(layoutVersion?: number | null): ImageSpec {
  return (layoutVersion ?? 2) >= 2 ? REWARD_SPEC_V2 : REWARD_SPEC_V1;
}
