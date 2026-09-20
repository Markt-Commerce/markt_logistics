import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors, typography } from './theme';

/**
 * A deliberate action, for every step a rider reports.
 *
 * All of them are done one-handed, on a bike, at a gate or a stall
 * counter, and each one tells somebody else something that is awkward
 * to walk back: a mis-tapped "I've arrived" sends a buyer to their door
 * for nothing, a mis-tapped "confirm pickup" makes the rider
 * responsible for a parcel still on the counter, and there is no
 * transition back out of a confirmed delivery at all.
 *
 * The gesture is the point. It costs a moment of deliberate attention
 * in exchange for never firing by accident in a pocket or a glove.
 */

const THUMB = 52;
const PADDING = 4;

interface Props {
  label: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export default function SlideToConfirm({ label, onConfirm, loading, disabled }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useSharedValue(0);

  const travel = Math.max(trackWidth - THUMB - PADDING * 2, 0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  // Snapping back is what makes a half-hearted swipe a no-op rather than
  // a confirmation, so it happens on every end that is not a success.
  const settle = useCallback(() => {
    offset.set(withSpring(0, { damping: 18, stiffness: 180 }));
  }, [offset]);

  const fire = useCallback(async () => {
    try {
      await onConfirm();
    } finally {
      // Back to the start whatever happened: on success the screen is
      // about to change anyway, and on failure a thumb stuck at the far
      // end reads as "done" for an action that was refused.
      settle();
    }
  }, [onConfirm, settle]);

  const pan = Gesture.Pan()
    // Claim horizontal movement only. Vertical belongs to the sheet this
    // sits inside, which the rider still needs to be able to drag.
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .enabled(!disabled && !loading && travel > 0)
    .onChange((event) => {
      offset.set(Math.min(Math.max(offset.get() + event.changeX, 0), travel));
    })
    .onEnd(() => {
      // Nine tenths, not the whole way: the last few pixels are hard to
      // reach with a thumb on a wide phone and nobody gets there by
      // accident.
      if (offset.get() >= travel * 0.9) {
        offset.set(withSpring(travel, { damping: 18, stiffness: 180 }));
        runOnJS(fire)();
      } else {
        offset.set(withSpring(0, { damping: 18, stiffness: 180 }));
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: offset.get() + THUMB,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: travel > 0 ? interpolate(offset.get(), [0, travel * 0.6], [1, 0]) : 1,
  }));

  return (
    <View
      style={[styles.track, disabled && styles.trackOff]}
      onLayout={handleLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Swipe right to confirm"
      // A slider is unusable with a screen reader, so assistive tech gets
      // the plain action instead of being asked to mime a gesture.
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => {
        if (!disabled && !loading) fire();
      }}
    >
      <Animated.View style={[styles.fill, fillStyle]} />

      <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <MaterialIcons name="double-arrow" size={22} color={colors.primary} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: THUMB + PADDING * 2,
    borderRadius: (THUMB + PADDING * 2) / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    padding: PADDING,
    overflow: 'hidden',
  },
  trackOff: { backgroundColor: colors.surfaceDim },
  // Trails the thumb, so the control shows how far along the gesture is
  // rather than only where the thumb ended up.
  fill: {
    position: 'absolute',
    left: PADDING,
    top: PADDING,
    bottom: PADDING,
    borderRadius: THUMB / 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  label: {
    ...typography.bodyBold,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: THUMB,
  },
  thumb: {
    position: 'absolute',
    left: PADDING,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
