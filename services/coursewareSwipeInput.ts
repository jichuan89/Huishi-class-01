import { CoursewareSwipe } from './coursewareSwipe.ts';
import { HandTargetTracker, type HandCandidate } from './handTargetTracker.ts';

/** Shared camera-to-navigation pipeline, also exercised by browser replay tests. */
export class CoursewareSwipeInput {
  private tracker = new HandTargetTracker({ confirmationMs: 180 });
  private swipe = new CoursewareSwipe();

  reset() {
    this.tracker.reset('single');
    this.swipe.reset();
  }

  update(candidates: HandCandidate[], at: number, aspect: number) {
    const hands = this.tracker.update(candidates.filter((hand) => hand.side === 'Left' && hand.confidence >= .75), at, 'single');
    const left = hands.active.left;
    const result = this.swipe.update(left && !left.stale && hands.phase === 'locked' ? left.landmarks : null, at, left?.side || 'Left', aspect);
    return { ...result, tracking: hands.phase };
  }
}
