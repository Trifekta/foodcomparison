import { Img, staticFile } from "remotion";
import { COPY } from "../spec";
import { RiseIn, Stage } from "../kit";

/**
 * Beat eight: how the answer actually arrives.
 *
 * The reference ends its story on a push notification, and it is the right
 * closing image for this product too - the customer uploads and then goes back
 * to their phone, and the thing that brings them back is a message. Showing it
 * sets the expectation the waiting screen then has to keep.
 *
 * Drawn as a notification card rather than a screenshot of one, so it carries
 * SnipSavor's own radius, border and type instead of a mock-up of somebody
 * else's operating system.
 */
export function Notification() {
  return (
    <Stage>
      <RiseIn distance={-160}>
        <div className="flex w-[1080px] items-start gap-7 rounded-[34px] border border-ink-200/80 bg-white px-11 py-9 shadow-[0_18px_48px_rgba(18,18,26,0.08)]">
          <Img
            src={staticFile("icons/icon-192.png")}
            className="h-[92px] w-[92px] shrink-0 rounded-[22px]"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-baseline gap-4">
              <span className="text-[30px] font-bold tracking-tight text-ink-900">
                {COPY.notificationApp}
              </span>
              <span className="ml-auto text-[26px] font-semibold text-slate-400">
                {COPY.notificationWhen}
              </span>
            </div>
            <p className="text-[42px] font-extrabold tracking-tight text-ink-900">
              {COPY.notificationTitle}
            </p>
            <p className="text-[32px] font-medium leading-snug text-slate-600">
              {COPY.notificationBody}
            </p>
          </div>
        </div>
      </RiseIn>
    </Stage>
  );
}
