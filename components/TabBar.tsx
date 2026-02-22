import { usePathname, useRouter } from 'expo-router';
import { Bell, Home, Map, Plus, User } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import AddModal from './AddModal';

export default function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [showAddModal, setShowAddModal] = useState(false);

  const tabs = [
    { name: 'Home', icon: Home, route: '/(tabs)' },
    { name: 'Map', icon: Map, route: '/(tabs)/map' },
    { name: 'Add', icon: Plus, route: null, isCenter: true }, // No route, opens modal
    { name: 'Notifications', icon: Bell, route: '/(tabs)/notifications' },
    { name: 'Profile', icon: User, route: '/(tabs)/profile' },
  ];

  const isActive = (route: string | null) => {
    if (!route) return false;
    if (route === '/(tabs)') {
      return pathname === '/(tabs)' || pathname === '/(tabs)/index';
    }
    return pathname === route;
  };

  const handleTabPress = (tab: typeof tabs[0]) => {
    if (tab.isCenter) {
      setShowAddModal(true);
    } else if (tab.route) {
      router.push(tab.route as any);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.route);

            return (
              <TouchableOpacity
                key={tab.name}
                style={[
                  styles.tab,
                  tab.isCenter && styles.centerTab,
                ]}
                onPress={() => handleTabPress(tab)}
                activeOpacity={0.7}
              >
                <Icon
                  size={tab.isCenter ? 28 : 24}
                  color={tab.isCenter ? '#fff' : (active ? '#16a34a' : '#6b7280')}
                  strokeWidth={active ? 2.5 : 2}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <AddModal 
        visible={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    backdropFilter: 'blur(10px)',
    alignItems: 'center',
    justifyContent: 'space-around',
    minWidth: 320,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  centerTab: {
    backgroundColor: '#16a34a',
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginHorizontal: 8,
  },
});