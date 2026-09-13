import { Img, staticFile } from "remotion";
import { Camera } from "lucide-react";
import { Caption, Card, CropFrame, RiseIn, Stage, useEntrance } from "../kit";
import { COPY } from "../spec";

/**
 * Beat four: what the customer actually has to do.
 *
 * The whole product asks for one thing and the ad has two seconds to make it
 * look like nothing: a screenshot falls into a frame. The crop brackets snap on
 * after it lands rather than being there already, so the motion says "captured"
 * instead of "placed in a box".
 *
 * The screenshot stand-in is cart-doc.png, the same asset the upload step uses,
 * so the thing falling into the frame in the ad is the thing on the screen the
 * ad sends them to.
 */
export function Upload() {
  const brackets = useEntrance(20);

  return (
    <Stage>
      <div className="flex flex-col items-center gap-12">
        <RiseIn distance={16}>
          <h2 className="text-center text-[68px] font-extrabold tracking-tight">
            {COPY.uploadTitle}
          </h2>
        </RiseIn>

        <RiseIn delay={6} distance={-260}>
          <CropFrame progress={brackets} arm={58} thickness={7}>
            <Card className="flex h-[420px] w-[560px] items-center justify-center bg-cream">
              <Img
                src={staticFile("food/cart-doc.png")}
                className="h-[300px] object-contain"
              />
            </Card>
          </CropFrame>
        </RiseIn>

        <div className="flex items-center gap-4">
          <RiseIn delay={26} distance={14}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-400 text-ink-900">
              <Camera className="h-7 w-7" strokeWidth={2.4} />
            </span>
          </RiseIn>
          <Caption delay={28}>{COPY.uploadSub}</Caption>
        </div>
      </div>
    </Stage>
  );
}
