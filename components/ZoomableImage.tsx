import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ZoomableImageProps = {
  uri: string;
  width?: number;
  height?: number;
  isActive?: boolean;
  onZoomChange?: (isZoomed: boolean) => void;
};

const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function ZoomableImage({
  uri,
  width = SCREEN_WIDTH,
  height = SCREEN_HEIGHT * 0.7,
  isActive = true,
  onZoomChange,
}: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset zoom when image becomes inactive
  useEffect(() => {
    if (!isActive && scale.value !== 1) {
      scale.value = withTiming(1);
      savedScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [isActive]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = Math.min(Math.max(savedScale.value * event.scale, 1), 4);
      scale.value = newScale;
      onZoomChange?.(newScale > 1);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        onZoomChange?.(false);
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        const maxTranslateX = (width * (scale.value - 1)) / 2;
        const maxTranslateY = (height * (scale.value - 1)) / 2;

        translateX.value = Math.min(
          Math.max(savedTranslateX.value + event.translationX, -maxTranslateX),
          maxTranslateX
        );
        translateY.value = Math.min(
          Math.max(savedTranslateY.value + event.translationY, -maxTranslateY),
          maxTranslateY
        );
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        onZoomChange?.(false);
      } else {
        // Zoom in to 2.5x centered on tap point
        const targetScale = 2.5;
        scale.value = withTiming(targetScale);
        savedScale.value = targetScale;

        // Calculate offset to center zoom on tap point
        const tapX = event.x - width / 2;
        const tapY = event.y - height / 2;
        translateX.value = withTiming(-tapX * (targetScale - 1));
        translateY.value = withTiming(-tapY * (targetScale - 1));
        savedTranslateX.value = -tapX * (targetScale - 1);
        savedTranslateY.value = -tapY * (targetScale - 1);
        onZoomChange?.(true);
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(doubleTapGesture, panGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={[styles.container, { width, height }]}>
      <GestureDetector gesture={composedGesture}>
        <AnimatedImage
          source={{ uri }}
          style={[styles.image, { width, height }, animatedStyle]}
          contentFit="contain"
        />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    flex: 1,
  },
});
