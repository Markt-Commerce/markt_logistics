/**
 * The rider's shell: four tabs, and the screens that sit on top of them.
 *
 * Everything used to live in one flat stack reachable only through a
 * floating avatar menu -- Go online, Wallet, Sign out. That put the wallet
 * two taps and one discovery behind a button with no label, and left
 * nowhere to put anything new: every feature had to go into that menu or
 * nowhere at all.
 *
 * Four tabs, which is what a rider actually does: find work, see what they
 * are carrying, check what they have been paid, and manage themselves. The
 * screens that are not destinations -- the QR scanner, the failure report --
 * stay as pushed screens with the bar hidden, because they are a step
 * inside a task rather than a place you go.
 */

import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { colors, typography } from '../../components/theme';

export default function DeliveryLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: 88,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          ...typography.caption,
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="availability-toggle"
        options={{
          title: 'Find work',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="explore" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="active-delivery"
        options={{
          title: 'Delivering',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="two-wheeler" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="account-balance-wallet" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />

      {/* Reached from Profile rather than given a fifth tab. Four is
          already the width of the bar, and a rider looks up what they
          delivered occasionally -- not as one of the things they do. */}
      <Tabs.Screen name="jobs" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />

      {/* Steps inside a task, not places. Reachable by push, absent from
          the bar -- a rider scanning a customer's code should not be one
          mis-tap from the earnings screen. */}
      <Tabs.Screen name="pod-scan" options={{ href: null }} />
      <Tabs.Screen name="report-failure" options={{ href: null }} />
    </Tabs>
  );
}
