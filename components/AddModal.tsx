import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AddModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function AddModal({ visible, onClose }: AddModalProps) {
  const router = useRouter();

const handleAddRound = () => {
  onClose();
  setTimeout(() => {
    router.push('/add-round/search-course');
  }, 100);
};

  const handleAddFriend = () => {
    onClose();
    setTimeout(() => {
      router.push('/add-friend');
    }, 100);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modal}>
          <TouchableOpacity 
            style={styles.option}
            onPress={handleAddRound}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="golf" size={28} color="#16a34a" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.optionTitle}>Add Round</Text>
              <Text style={styles.optionSubtitle}>Rate a course you played</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.option}
            onPress={handleAddFriend}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="person-add" size={28} color="#16a34a" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.optionTitle}>Add Friend</Text>
              <Text style={styles.optionSubtitle}>Connect with golfers</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    fontFamily: 'Inter',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 20,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
});