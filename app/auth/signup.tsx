import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { handleError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { isValidEmail, sanitizeName, validatePassword } from '../../lib/validation';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const router = useRouter();

  const handleSignup = async () => {
    const trimmedName = sanitizeName(name);
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password || !trimmedName) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.errors[0]);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name: trimmedName,
          },
        },
      });

      if (error) {
        handleError(error, 'Signup');
      } else {
        Alert.alert('Success!', 'Account created! Check your email to confirm.', [
          { text: 'OK', onPress: () => router.replace('/auth/login') }
        ]);
      }
    } catch (error) {
      handleError(error, 'Signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>Start sharing your golf journey</Text>

        <TextInput
          style={[
            styles.input,
            focusedInput === 'name' && styles.inputFocused,
          ]}
          placeholder="Full Name"
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          onFocus={() => setFocusedInput('name')}
          onBlur={() => setFocusedInput(null)}
          accessibilityLabel="Full name input"
          accessibilityHint="Enter your full name"
        />

        <TextInput
          style={[
            styles.input,
            focusedInput === 'email' && styles.inputFocused,
          ]}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          onFocus={() => setFocusedInput('email')}
          onBlur={() => setFocusedInput(null)}
          accessibilityLabel="Email input"
          accessibilityHint="Enter your email address"
        />

        <TextInput
          style={[
            styles.input,
            focusedInput === 'password' && styles.inputFocused,
          ]}
          placeholder="Password (min 8 characters)"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          onFocus={() => setFocusedInput('password')}
          onBlur={() => setFocusedInput(null)}
          accessibilityLabel="Password input"
          accessibilityHint="Enter a password with at least 8 characters, including uppercase, lowercase, and a number"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}
          accessibilityLabel={loading ? 'Creating account' : 'Sign up'}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go to login"
          accessibilityRole="button"
        >
          <Text style={styles.link}>Already have an account? Log in</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 48,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1a1a1a',
  },
  inputFocused: {
    borderColor: '#16a34a',
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#16a34a',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#86efac',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  link: {
    textAlign: 'center',
    color: '#16a34a',
    fontSize: 16,
    fontFamily: 'Inter',
  },
});
