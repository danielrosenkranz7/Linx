import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

type ToastType = 'error' | 'success' | 'info';

type ToastMessage = {
  id: number;
  message: string;
  type: ToastType;
};

let toastId = 0;
let addToastFn: ((message: string, type: ToastType) => void) | null = null;

export const toast = {
  error: (message: string) => addToastFn?.(message, 'error'),
  success: (message: string) => addToastFn?.(message, 'success'),
  info: (message: string) => addToastFn?.(message, 'info'),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    addToastFn = (message: string, type: ToastType) => {
      const id = ++toastId;
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };

    return () => {
      addToastFn = null;
    };
  }, []);

  return (
    <>
      {children}
      {toasts.map((t, index) => (
        <Toast key={t.id} message={t.message} type={t.type} index={index} />
      ))}
    </>
  );
}

function Toast({ message, type, index }: { message: string; type: ToastType; index: number }) {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const backgroundColor = type === 'error' ? '#ef4444' : type === 'success' ? '#16a34a' : '#3b82f6';

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor, opacity: fadeAnim, bottom: 100 + index * 60 },
      ]}
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
});
