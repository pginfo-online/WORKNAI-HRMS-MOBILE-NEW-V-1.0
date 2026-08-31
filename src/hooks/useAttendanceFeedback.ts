/**
 * useAttendanceFeedback.ts
 *
 * Imperative hook that manages the state for the PhonePe-style
 * AttendanceFeedback bottom bar. Replaces Toast on the attendance screens.
 *
 * Usage:
 *   const { feedbackState, showFeedback, hideFeedback } = useAttendanceFeedback();
 *   ...
 *   showFeedback({ message: 'Checked in!', variant: 'success' });
 *   ...
 *   <AttendanceFeedback {...feedbackState} onHide={hideFeedback} />
 */

import { useState, useRef, useCallback } from 'react';
import type { FeedbackVariant } from '../components/ui/AttendanceFeedback';

export interface FeedbackOptions {
  message: string;
  variant: FeedbackVariant;
  /** Auto-dismiss duration in ms. Pass 0 to disable auto-dismiss. Default: 3500 */
  duration?: number;
  /** Optional sub-message / detail line */
  subMessage?: string;
}

export interface FeedbackState {
  visible: boolean;
  message: string;
  subMessage?: string;
  variant: FeedbackVariant;
}

export interface UseAttendanceFeedbackReturn {
  feedbackState: FeedbackState;
  showFeedback: (options: FeedbackOptions) => void;
  hideFeedback: () => void;
}

const DEFAULT_DURATION = 3500;

export function useAttendanceFeedback(): UseAttendanceFeedbackReturn {
  const [feedbackState, setFeedbackState] = useState<FeedbackState>({
    visible: false,
    message: '',
    subMessage: undefined,
    variant: 'info',
  });

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideFeedback = useCallback(() => {
    setFeedbackState((prev) => ({ ...prev, visible: false }));
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const showFeedback = useCallback(
    ({ message, variant, duration = DEFAULT_DURATION, subMessage }: FeedbackOptions) => {
      // Clear any existing timer before showing a new message
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }

      setFeedbackState({ visible: true, message, variant, subMessage });

      if (duration > 0) {
        dismissTimerRef.current = setTimeout(() => {
          setFeedbackState((prev) => ({ ...prev, visible: false }));
          dismissTimerRef.current = null;
        }, duration);
      }
    },
    []
  );

  return { feedbackState, showFeedback, hideFeedback };
}
