import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function DateSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  const course = {
    id: params.courseId,
    name: params.courseName as string,
    location: params.courseLocation as string,
  };

  const handleContinue = () => {
    // Navigate to partners screen with accumulated data
    router.push({
      pathname: '/add-round/partners',
      params: {
        courseId: course.id,
        courseName: course.name,
        courseLocation: course.location,
        datePlayed: date.toISOString(),
      },
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>When did you play?</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Course Info */}
      <View style={styles.courseInfo}>
        <Text style={styles.courseName}>{course.name}</Text>
        <Text style={styles.courseLocation}>
          <Ionicons name="location-outline" size={14} color="#6b7280" />
          {' '}{course.location}
        </Text>
      </View>

      {/* Date Display */}
      <View style={styles.content}>
        <View style={styles.dateDisplay}>
          <Ionicons name="calendar" size={32} color="#16a34a" />
          <Text style={styles.dateText}>{formatDate(date)}</Text>
        </View>

        {/* iOS Date Picker (always visible) */}
        {Platform.OS === 'ios' && (
          <DateTimePicker
            value={date}
            mode="date"
            display="spinner"
            onChange={(event, selectedDate) => {
              if (selectedDate) setDate(selectedDate);
            }}
            maximumDate={new Date()}
            style={styles.datePicker}
          />
        )}

        {/* Android Date Picker Button */}
        {Platform.OS === 'android' && (
          <>
            <TouchableOpacity 
              style={styles.androidPickerButton}
              onPress={() => setShowPicker(true)}
            >
              <Text style={styles.androidPickerText}>Change Date</Text>
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowPicker(false);
                  if (selectedDate) setDate(selectedDate);
                }}
                maximumDate={new Date()}
              />
            )}
          </>
        )}
      </View>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  courseInfo: {
    padding: 20,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  courseLocation: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
    marginBottom: 32,
  },
  dateText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  datePicker: {
    width: '100%',
  },
  androidPickerButton: {
    padding: 16,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    alignItems: 'center',
  },
  androidPickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter',
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 12,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
});