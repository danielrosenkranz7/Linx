import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { toast } from '../../lib/toast';

export default function ScoreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [score, setScore] = useState('');
  const [holes, setHoles] = useState<'18' | 'front9' | 'back9'>('18');
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const characterLimit = 500;
  const remainingChars = characterLimit - notes.length;

  const holesOptions = [
    { value: '18', label: '18' },
    { value: 'front9', label: 'Front 9' },
    { value: 'back9', label: 'Back 9' },
  ];

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10 - photos.length,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map(asset => asset.uri);
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow camera access.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    // Validate score if provided
    if (score) {
      const scoreNum = parseInt(score, 10);
      const isNineHoles = holes === 'front9' || holes === 'back9';
      const minScore = isNineHoles ? 9 : 18;  // At least 1 per hole
      const maxScore = isNineHoles ? 99 : 199; // Reasonable max

      if (isNaN(scoreNum) || scoreNum < minScore || scoreNum > maxScore) {
        toast.error(`Score must be between ${minScore} and ${maxScore} for ${isNineHoles ? '9' : '18'} holes`);
        return;
      }
    }

    router.push({
      pathname: '/add-round/rating',
      params: {
        ...params,
        score: score || '',
        holes: holes,
        photos: JSON.stringify(photos),
        notes: notes.trim(),
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/add-round/rating',
      params: {
        ...params,
        score: '',
        holes: '18',
        photos: JSON.stringify([]),
        notes: '',
      },
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Round Details</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipButton}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score Entry */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Score</Text>
          <TextInput
            style={styles.scoreInput}
            placeholder="Score"
            value={score}
            onChangeText={setScore}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        {/* Holes Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Holes Played</Text>
          <View style={styles.holesContainer}>
            {holesOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.holesOption,
                  holes === option.value && styles.holesOptionSelected
                ]}
                onPress={() => setHoles(option.value as any)}
              >
                <Text style={[
                  styles.holesOptionText,
                  holes === option.value && styles.holesOptionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos {photos.length > 0 && `(${photos.length}/10)`}</Text>
          
          <View style={styles.photoButtons}>
            <TouchableOpacity 
              style={styles.photoButton}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={24} color="#16a34a" />
              <Text style={styles.photoButtonText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.photoButton, photos.length >= 10 && styles.photoButtonDisabled]}
              onPress={pickImage}
              disabled={photos.length >= 10}
            >
              <Ionicons name="images" size={24} color={photos.length >= 10 ? '#9ca3af' : '#16a34a'} />
              <Text style={[styles.photoButtonText, photos.length >= 10 && styles.photoButtonTextDisabled]}>
                Gallery
              </Text>
            </TouchableOpacity>
          </View>

          {photos.length > 0 && (
            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo }} style={styles.photo} />
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.subtitle}>
            Course conditions, highlights, tips...
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="What made this round memorable?"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={characterLimit}
            textAlignVertical="top"
          />
          <Text style={[
            styles.charCount,
            remainingChars < 50 && styles.charCountWarning
          ]}>
            {remainingChars} characters remaining
          </Text>
        </View>
      </ScrollView>

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
    </KeyboardAvoidingView>
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
  skipButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  scoreInput: {
    fontSize: 36,
    fontWeight: '700',
    color: '#16a34a',
    textAlign: 'center',
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#86efac',
    fontFamily: 'Inter',
  },
  holesContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  holesOption: {
    flex: 1,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  holesOptionSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 2,
  },
  holesOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  holesOptionTextSelected: {
    color: '#16a34a',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  photoButtonDisabled: {
    opacity: 0.5,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  photoButtonTextDisabled: {
    color: '#9ca3af',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoContainer: {
    width: '30%',
    aspectRatio: 1,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
    fontFamily: 'Inter',
  },
  textArea: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter',
    color: '#1a1a1a',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
    textAlign: 'right',
    fontFamily: 'Inter',
  },
  charCountWarning: {
    color: '#f59e0b',
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