import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

export default function OnboardingProfile() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [handicap, setHandicap] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    // Validate handicap if provided
    if (handicap) {
      const handicapNum = parseFloat(handicap);
      if (isNaN(handicapNum) || handicapNum < 0 || handicapNum > 54) {
        toast.error('Handicap must be between 0 and 54');
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if username is taken
      if (username) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.toLowerCase())
          .neq('id', user.id)
          .single();

        if (existingUser) {
          toast.error('Username is already taken');
          setSaving(false);
          return;
        }
      }

      // Update profile
      const updates: any = {
        id: user.id,
        updated_at: new Date().toISOString(),
      };

      if (username) updates.username = username.toLowerCase();
      if (bio) updates.bio = bio.trim();
      if (handicap) updates.handicap = parseFloat(handicap);

      const { error } = await supabase
        .from('profiles')
        .upsert(updates);

      if (error) throw error;

      router.push('/onboarding/home-course');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/home-course');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>Step 1 of 3</Text>
          </View>
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="person" size={40} color="#16a34a" />
          </View>
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>
            Help other golfers get to know you
          </Text>

          {/* Username */}
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputPrefix}>@</Text>
              <TextInput
                style={styles.inputWithPrefix}
                placeholder="johndoe"
                placeholderTextColor="#9ca3af"
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={20}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us about your golf game..."
              placeholderTextColor="#9ca3af"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={100}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/100</Text>
          </View>

          {/* Handicap */}
          <View style={styles.field}>
            <Text style={styles.label}>Handicap</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 12.5"
              placeholderTextColor="#9ca3af"
              value={handicap}
              onChangeText={(text) => {
                const filtered = text.replace(/[^0-9.]/g, '');
                const parts = filtered.split('.');
                if (parts.length > 2) return;
                setHandicap(filtered);
              }}
              keyboardType="decimal-pad"
              maxLength={5}
            />
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, saving && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={saving}
        >
          <Text style={styles.continueButtonText}>
            {saving ? 'Saving...' : 'Continue'}
          </Text>
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
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  stepIndicator: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  skipText: {
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    fontFamily: 'Inter',
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1a1a1a',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputPrefix: {
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  inputWithPrefix: {
    flex: 1,
    padding: 16,
    paddingLeft: 4,
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1a1a1a',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    padding: 18,
    borderRadius: 12,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter',
  },
});
