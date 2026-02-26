import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [handicap, setHandicap] = useState('');
  const [homeCourseId, setHomeCourseId] = useState('');
  const [homeCourseName, setHomeCourseName] = useState('');
  
  const [showCourseSearch, setShowCourseSearch] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [courseSearchResults, setCourseSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setName(profileData.name || '');
        setUsername(profileData.username || '');
        setBio(profileData.bio || '');
        setHandicap(profileData.handicap?.toString() || '');
        setHomeCourseId(profileData.home_course_id || '');
        
        // Load home course name if exists
        if (profileData.home_course_id) {
          const { data: courseData } = await supabase
            .from('courses')
            .select('name')
            .eq('id', profileData.home_course_id)
            .single();
          
          if (courseData) {
            setHomeCourseName(courseData.name);
          }
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchCourses = async (query: string) => {
    if (!query || query.length < 3) {
      setCourseSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places:searchText`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY || '',
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id',
          },
          body: JSON.stringify({
            textQuery: query + ' golf course',
          }),
        }
      );

      const data = await response.json();

      if (data.places) {
        const courses = data.places.map((place: any) => ({
          google_place_id: place.id,
          name: place.displayName?.text || place.displayName,
          location: place.formattedAddress,
          latitude: place.location?.latitude,
          longitude: place.location?.longitude,
        }));
        setCourseSearchResults(courses);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCourseSelect = async (course: any) => {
    try {
      // Check if course exists in database
      const { data: existingCourse } = await supabase
        .from('courses')
        .select('*')
        .eq('google_place_id', course.google_place_id)
        .single();

      let courseId;

      if (existingCourse) {
        courseId = existingCourse.id;
      } else {
        // Create course if it doesn't exist
        const { data: newCourse, error } = await supabase
          .from('courses')
          .insert([
            {
              name: course.name,
              location: course.location,
              google_place_id: course.google_place_id,
              latitude: course.latitude,
              longitude: course.longitude,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error('Error creating course:', error);
          Alert.alert('Error', 'Failed to add course.');
          return;
        }

        courseId = newCourse.id;
      }

      setHomeCourseId(courseId);
      setHomeCourseName(course.name);
      setShowCourseSearch(false);
      setCourseSearchQuery('');
      setCourseSearchResults([]);
    } catch (error) {
      console.error('Error selecting course:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if username is taken (if changed)
      if (username) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .neq('id', user.id)
          .single();

        if (existingUser) {
          Alert.alert('Username Taken', 'This username is already in use. Please choose another.');
          setSaving(false);
          return;
        }
      }

      const updates = {
        id: user.id,
        name: name.trim() || null,
        username: username.trim().toLowerCase() || null,
        bio: bio.trim() || null,
        handicap: handicap ? parseFloat(handicap) : null,
        home_course_id: homeCourseId || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates);

      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      } else {
        Alert.alert('Success', 'Profile updated!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete user data (cascades will handle related data)
      // The profile deletion will cascade to rounds, comments, likes, etc.
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
        throw profileError;
      }

      // Sign out the user (this effectively "deletes" the auth account from their perspective)
      // Note: Full auth user deletion requires admin API or Edge Function
      await supabase.auth.signOut();

      toast.success('Account deleted');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

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
          <Ionicons name="close" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
        </View>

        {/* Username */}
        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="username"
            value={username}
            onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            maxLength={30}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>Letters, numbers, and underscores only</Text>
        </View>

        {/* Bio */}
        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us about yourself..."
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

        {/* Home Course */}
        <View style={styles.field}>
          <Text style={styles.label}>Home Course</Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setShowCourseSearch(true)}
          >
            <View style={styles.searchButtonContent}>
              {homeCourseName ? (
                <>
                  <View style={styles.searchButtonInfo}>
                    <Ionicons name="golf" size={20} color="#16a34a" />
                    <Text style={styles.searchButtonText}>{homeCourseName}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </>
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#9ca3af" />
                  <Text style={styles.searchButtonPlaceholder}>Search for a course</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={() => setShowDeleteConfirm(true)}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
          </TouchableOpacity>
          <Text style={styles.dangerZoneHint}>
            This will permanently delete your account and all your data.
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Course Search Modal */}
      <Modal
        visible={showCourseSearch}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowCourseSearch(false);
              setCourseSearchQuery('');
              setCourseSearchResults([]);
            }}>
              <Ionicons name="close" size={28} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Search Course</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.modalSearchContainer}>
            <Ionicons name="search" size={20} color="#9ca3af" style={styles.modalSearchIcon} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search for a golf course..."
              value={courseSearchQuery}
              onChangeText={(text) => {
                setCourseSearchQuery(text);
                searchCourses(text);
              }}
              autoFocus
            />
          </View>

          <ScrollView style={styles.modalResults}>
            {courseSearchResults.map((course, index) => (
              <TouchableOpacity
                key={index}
                style={styles.courseResult}
                onPress={() => handleCourseSelect(course)}
              >
                <View style={styles.courseIcon}>
                  <Ionicons name="golf" size={24} color="#16a34a" />
                </View>
                <View style={styles.courseResultInfo}>
                  <Text style={styles.courseResultName}>{course.name}</Text>
                  <Text style={styles.courseResultLocation}>{course.location}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIcon}>
              <Ionicons name="warning" size={48} color="#ef4444" />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Account?</Text>
            <Text style={styles.deleteModalText}>
              This action cannot be undone. All your rounds, ratings, comments, and profile data will be permanently deleted.
            </Text>

            <Text style={styles.deleteModalLabel}>
              Type <Text style={styles.deleteModalBold}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              style={styles.deleteModalInput}
              placeholder="DELETE"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
            />

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteModalConfirmButton,
                  (deleteConfirmText !== 'DELETE' || deleting) && styles.deleteModalConfirmButtonDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
              >
                <Text style={styles.deleteModalConfirmText}>
                  {deleting ? 'Deleting...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'Inter',
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
  content: {
    flex: 1,
    padding: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
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
    padding: 14,
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1a1a1a',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 6,
    fontFamily: 'Inter',
  },
  charCount: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 6,
    textAlign: 'right',
    fontFamily: 'Inter',
  },
  searchButton: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
  },
  searchButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchButtonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  searchButtonText: {
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1a1a1a',
    flex: 1,
  },
  searchButtonPlaceholder: {
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#9ca3af',
    marginLeft: 10,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalSearchIcon: {
    marginRight: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1a1a1a',
  },
  modalResults: {
    flex: 1,
    paddingHorizontal: 20,
  },
  courseResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  courseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  courseResultInfo: {
    flex: 1,
  },
  courseResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  courseResultLocation: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  // Danger Zone styles
  dangerZone: {
    marginTop: 20,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  dangerZoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    fontFamily: 'Inter',
  },
  dangerZoneHint: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  // Delete Modal styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  deleteModalIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  deleteModalText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  deleteModalLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  deleteModalBold: {
    fontWeight: '700',
    color: '#ef4444',
  },
  deleteModalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  deleteModalConfirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  deleteModalConfirmButtonDisabled: {
    opacity: 0.5,
  },
  deleteModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter',
  },
});