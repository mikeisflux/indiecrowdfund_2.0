import Image from "next/image";

/**
 * Head-to-body proportion reference, shared by the Content Guidelines and the
 * NSFW Policy.
 *
 * Both documents set an age standard a creator can fail — "body proportions
 * consistent with adult skeletal development" in one, "ambiguous-age
 * characters" in the other — without either one showing what the proportions
 * actually are. The same reference answers both, so it lives in one place:
 * two policy pages that quietly drift apart on what an adult figure looks
 * like is worse than not illustrating it at all.
 *
 * `policyNote` carries the per-document pointer back into whichever section
 * the reference is serving.
 */
export function ProperProportions({
  policyNote,
}: {
  policyNote?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold mb-3">Proper Proportions</h3>
      <p className="mb-4">
        Head-to-body ratio is the single most reliable indicator of a
        figure&apos;s age, and it holds across art styles — including stylized
        and manga-influenced work. An adult figure runs roughly eight heads
        tall; the ratio drops steadily through adolescence to about four heads
        at one year old. A character drawn at five or six heads tall reads as a
        child no matter what age the script assigns them.
      </p>
      <p className="mb-4">
        Two references below — one male, one female, and one realistic, one
        stylized — because the standard applies to both and does not bend for
        art style. The proportions differ in build, not in the ratio that
        signals age.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <figure className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white p-4">
          <Image
            src="/content-guidelines/proper-proportions-male.jpg"
            alt="Figure-drawing reference chart titled Ideal Proportion at Various Ages, comparing male figures from one year old to adult. Head-to-body ratio decreases from eight heads tall for an adult, to 7.5 at fifteen years, 7 at ten years, 6 at five years, 5 at three years, and 4 at one year, with a matching row of head sizes above."
            width={736}
            height={784}
            className="w-full h-auto"
            sizes="(max-width: 768px) 100vw, 45vw"
          />
          <figcaption className="mt-3 text-sm text-muted-foreground">
            Realistic male proportions, one year to adult.
          </figcaption>
        </figure>
        <figure className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white p-4">
          <Image
            src="/content-guidelines/proper-proportions-female.jpg"
            alt="Figure-drawing reference chart of stylized female figures against a numbered head-height scale from one to nine. Eight figures increase in height from roughly two and a half heads tall at zero to two years, through three to five years and five to nine years, then by height in centimetres from 110-130 up to 170-180, with the tallest adult figure reaching about nine heads."
            width={600}
            height={442}
            className="w-full h-auto"
            sizes="(max-width: 768px) 100vw, 45vw"
          />
          <figcaption className="mt-3 text-sm text-muted-foreground">
            Stylized female proportions, labelled by age for children and by
            height in centimetres for older figures. Note that a stylized adult
            may run nine heads tall rather than eight — stylization lengthens
            the figure, it does not shrink the head-to-body ratio toward a
            child&apos;s.
          </figcaption>
        </figure>
      </div>
      {policyNote && (
        <p className="mt-4 mb-0 text-sm text-muted-foreground">{policyNote}</p>
      )}
    </div>
  );
}
