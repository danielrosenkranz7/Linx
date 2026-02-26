import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type Friend = {
  id: string;
  name: string;
  username: string;
  avatar_url?: string;
};

export default function PartnersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartners, setSelectedPartners] = useState<Friend[]>([]);
  const [manualNames, setManualNames] = useState('');
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get users that the current user follows
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          following:profiles!friendships_following_id_fkey(
            id,
            name,
            username,
            avatar_url
          )
        `)
        .eq('follower_id', user.id);

      if (error) throw error;

      // Extract the friend profiles
      const friends = (data || [])
        .map(item => {
          const f = Array.isArray(item.following) ? item.following[0] : item.following;
          return f;
        })
        .filter(Boolean)
        .map((f: any) => ({
          id: f.id,
          name: f.name || 'Unknown',
          username: f.username || '',
          avatar_url: f.avatar_url,
        }));

      setFriendsList(friends);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friendsList.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const togglePartner = (friend: any) => {
    if (selectedPartners.some(p => p.id === friend.id)) {
      setSelectedPartners(selectedPartners.filter(p => p.id !== friend.id));
    } else {
      setSelectedPartners([...selectedPartners, friend]);
    }
  };

  const handleContinue = () => {
    const partnersData = {
      selectedFriends: selectedPartners,
      manualNames: manualNames.trim(),
    };

    router.push({
      pathname: '/add-round/score',
      params: {
        ...params,
        partners: JSON.stringify(partnersData),
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/add-round/score',
      params: {
        ...params,
        partners: JSON.stringify({ selectedFriends: [], manualNames: '' }),
      },
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
        <Text style={styles.headerTitle}>Playing Partners</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipButton}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Selected Partners */}
      {selectedPartners.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>Selected ({selectedPartners.length})</Text>
          <View style={styles.selectedList}>
            {selectedPartners.map(partner => (
              <View key={partner.id} style={styles.selectedChip}>
                <Text style={styles.selectedChipText}>{partner.name}</Text>
                <TouchableOpacity onPress={() => togglePartner(partner)}>
                  <Ionicons name="close-circle" size={18} color="#16a34a" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      <ScrollView style={styles.content}>
        {/* Friends List */}
        <Text style={styles.sectionTitle}>Your Friends</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#16a34a" />
            <Text style={styles.loadingText}>Loading friends...</Text>
          </View>
        ) : filteredFriends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No friends match your search' : 'No friends yet'}
            </Text>
            {!searchQuery && (
              <Text style={styles.emptySubtext}>
                Follow other golfers to add them as partners
              </Text>
            )}
          </View>
        ) : (
          filteredFriends.map(friend => {
            const isSelected = selectedPartners.some(p => p.id === friend.id);
            return (
              <TouchableOpacity
                key={friend.id}
                style={[styles.friendCard, isSelected && styles.friendCardSelected]}
                onPress={() => togglePartner(friend)}
              >
                {friend.avatar_url ? (
                  <Image source={{ uri: friend.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{friend.name[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  {friend.username && (
                    <Text style={styles.friendUsername}>@{friend.username}</Text>
                  )}
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                )}
              </TouchableOpacity>
            );
          })
        )}

        {/* Manual Entry */}
        <Text style={styles.sectionTitle}>Or type names manually</Text>
        <TextInput
          style={styles.manualInput}
          placeholder="e.g., John Smith, Jane Doe"
          value={manualNames}
          onChangeText={setManualNames}
          multiline
        />
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
  skipButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  searchContainer: {
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
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1a1a1a',
  },
  selectedContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  selectedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  selectedChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
    marginTop: 8,
    fontFamily: 'Inter',
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  friendCardSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    fontFamily: 'Inter',
    textAlign: 'center',
    marginTop: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    fontFamily: 'Inter',
  },
  friendUsername: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  manualInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1a1a1a',
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#f9fafb',
    marginBottom: 20,
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