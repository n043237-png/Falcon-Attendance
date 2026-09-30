import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CustomAlert as Alert } from '../../components/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import { getEmployees, updateEmployeeStatus, resetPassword, deleteEmployee, updateJobStatus, Employee } from '../../api/adminApi';

export default function EmployeesScreen({ navigation }: any) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await getEmployees();
      setEmployees(data.items || []);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPermanent = (id: number, name: string) => {
    Alert.alert(
      'Confirm Permanent Status',
      `Mark ${name} as a Permanent employee? This will conclude their probation period.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const res = await updateJobStatus(id, { jobStatus: 'Permanent' });
              if (res.success) {
                Alert.alert('Success', `${name} is now confirmed as Permanent.`);
                fetchEmployees();
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update job status');
            }
          }
        }
      ]
    );
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const res = await updateEmployeeStatus(id, newStatus);
      if (res.success) {
        Alert.alert('Success', res.message);
        fetchEmployees();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Delete Employee',
      'Are you sure you want to completely delete this employee? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteEmployee(id);
              if (res.success) {
                Alert.alert('Deleted', res.message);
                fetchEmployees();
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete employee');
            }
          }
        }
      ]
    );
  };

  const handleResetPassword = async (id: number) => {
    Alert.alert(
      'Reset Password',
      'Are you sure you want to reset this employee\'s password?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await resetPassword(id);
              if (res.success) {
                Alert.alert('Password Reset', `New Temporary Password:\n\n${res.data.tempPassword}\n\nPlease share this with the employee.`);
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error?.message || 'Failed to reset password');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {item.name}
          </Text>
          <Text style={styles.employeeIdText}>ID: {item.employeeId}</Text>
        </View>

        <View style={styles.badgeColumn}>
          <View style={[styles.statusBadge, item.jobStatus === 'Provisional' ? styles.badgeProvisional : styles.badgePermanent]}>
            <Text style={[styles.statusText, item.jobStatus === 'Provisional' ? styles.badgeProvisionalText : styles.badgePermanentText]}>
              {item.jobStatus === 'Provisional' ? 'PROVISIONAL' : 'PERMANENT'}
            </Text>
          </View>
          <View style={[styles.statusBadge, item.status === 'active' ? styles.badgeActive : styles.badgeInactive]}>
            <View style={[styles.statusDot, { backgroundColor: item.status === 'active' ? '#16A34A' : '#DC2626' }]} />
            <Text style={[styles.statusText, item.status === 'active' ? styles.badgeActiveText : styles.badgeInactiveText]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.detailText}>{item.email}</Text>
      <Text style={styles.detailText}>{item.role.toUpperCase()}</Text>
      {item.department && (
        <Text style={styles.detailText}>{item.designation} - {item.department}</Text>
      )}
      {item.jobStatus === 'Provisional' && item.provisionalEndDate && (
        <Text style={[styles.detailText, { color: '#B45309', fontWeight: '600', marginTop: 2 }]}>
          Probation Ends: {item.provisionalEndDate}
        </Text>
      )}
      
      <View style={styles.cardActions}>
        {item.jobStatus === 'Provisional' && (
          <TouchableOpacity 
            style={[styles.actionBtn, styles.actionBtnPermanent]}
            onPress={() => handleMarkPermanent(item.id, item.name)}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-done-circle-outline" size={15} color="#059669" />
            <Text style={[styles.actionBtnText, { color: '#059669' }]}>Permanent</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.actionBtn, styles.actionBtnReset]}
          onPress={() => handleResetPassword(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="key-outline" size={15} color="#2563EB" />
          <Text style={[styles.actionBtnText, { color: '#2563EB' }]}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.actionBtnEdit]}
          onPress={() => navigation.navigate('EditEmployee', { employee: item })}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={15} color="#16A34A" />
          <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.actionBtn,
            item.status === 'active' ? styles.actionBtnDeactivate : styles.actionBtnActivate
          ]}
          onPress={() => handleToggleStatus(item.id, item.status)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={item.status === 'active' ? "close-circle-outline" : "checkmark-circle-outline"} 
            size={15} 
            color={item.status === 'active' ? '#DC2626' : '#16A34A'} 
          />
          <Text style={[styles.actionBtnText, { color: item.status === 'active' ? '#DC2626' : '#16A34A' }]}>
            {item.status === 'active' ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>

        {item.status === 'inactive' && (
          <TouchableOpacity 
            style={[styles.actionBtn, styles.actionBtnDelete]}
            onPress={() => handleDelete(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={15} color="#DC2626" />
            <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manage Employees</Text>
        <TouchableOpacity onPress={fetchEmployees} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#007bff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('AddEmployee', { onGoBack: fetchEmployees })}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingTop: 50, // Safe area for notch
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 5,
  },
  loader: {
    marginTop: 50,
  },
  listContainer: {
    padding: 15,
    paddingBottom: 80, // Space for FAB
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  employeeIdText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007bff',
  },
  badgeColumn: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePermanent: {
    backgroundColor: '#D1FAE5',
  },
  badgePermanentText: {
    color: '#047857',
  },
  badgeProvisional: {
    backgroundColor: '#FEF3C7',
  },
  badgeProvisionalText: {
    color: '#B45309',
  },
  badgeActive: {
    backgroundColor: '#DCFCE7',
  },
  badgeActiveText: {
    color: '#15803D',
  },
  badgeInactive: {
    backgroundColor: '#FEE2E2',
  },
  badgeInactiveText: {
    color: '#B91C1C',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  detailText: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  actionBtn: {
    flexGrow: 1,
    minWidth: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007bff',
    backgroundColor: '#FFFFFF',
  },
  actionBtnPermanent: {
    borderColor: '#059669',
  },
  actionBtnReset: {
    borderColor: '#007bff',
  },
  actionBtnEdit: {
    borderColor: '#16A34A',
  },
  actionBtnDeactivate: {
    borderColor: '#DC2626',
  },
  actionBtnActivate: {
    borderColor: '#16A34A',
  },
  actionBtnDelete: {
    borderColor: '#DC2626',
  },
  actionBtnText: {
    marginLeft: 5,
    fontSize: 13,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#007bff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
});
