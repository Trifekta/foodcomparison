import { Img, staticFile } from "remotion";
import { GuideRules, Guides, PopIn, Stage } from "../kit";

/**
 * Beat three: the mark arrives.
 *
 * Lifted almost exactly from the reference, which builds its icon at the
 * intersection of two dotted rings while guide rules draw through the frame.
 * It is the beat that makes the whole thing feel designed rather than
 * assembled, and it costs two circles and a spring.
 *
 * The icon is the committed PNG rather than a redrawing of it. app/icon.svg is
 * the one place the mark is drawn, `npm run icons` renders every size from it,
 * and a hand-copied version in the video would be the first thing to go stale
 * the next time somebody touches the letterform.
 */
export function IconBuild() {
  return (
    <Stage>
      <Guides delay={0} size={560} />
      <GuideRules delay={8} gap={210} />

      {/* No caption. The reference gives this beat to the mark alone, and it is
          the one moment in eighteen seconds where nothing is being explained -
          which is what makes the four how-it-works beats after it readable. */}
      <PopIn delay={6} from={0.4}>
        <Img
          src={staticFile("icons/icon-512.png")}
          className="h-[300px] w-[300px] rounded-[66px]"
        />
      </PopIn>
    </Stage>
  );
}
