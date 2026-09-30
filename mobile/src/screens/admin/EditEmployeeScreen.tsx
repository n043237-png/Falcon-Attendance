import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { CustomAlert as Alert } from '../../components/CustomAlert';
import { editEmployee } from '../../api/adminApi';
import { Ionicons } from '@expo/vector-icons';

export default function EditEmployeeScreen({ route, navigation }: any) {
  const { employee } = route.params;
  
  const [name, setName] = useState(employee.name || '');
  const [email, setEmail] = useState(employee.email || '');
  const [phone, setPhone] = useState(employee.phone || '');
  const [department, setDepartment] = useState(employee.department || '');
  const [designation, setDesignation] = useState(employee.designation || '');
  const [jobStatus, setJobStatus] = useState<'Permanent' | 'Provisional'>(employee.jobStatus || 'Permanent');
  const [provisionalStartDate, setProvisionalStartDate] = useState(
    employee.provisionalStartDate ? String(employee.provisionalStartDate).slice(0, 10) : ''
  );
  const initialRoles = (employee.roles && employee.roles.length > 0)
    ? employee.roles
    : [employee.role || 'employee'];
  const [roles, setRoles] = useState<string[]>(initialRoles);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!name || !email) {
      Alert.alert('Error', 'Name and Email are required.');
      return;
    }
    if (roles.length === 0) {
      Alert.alert('Error', 'At least one role must be selected.');
      return;
    }
    try {
      setLoading(true);
      const res = await editEmployee(employee.id, {
        name,
        email,
        phone,
        department,
        designation,
        roles,
        role: roles.includes('admin') ? 'admin' : 'employee',
        jobStatus,
        provisionalStartDate: jobStatus === 'Provisional' ? (provisionalStartDate || null) : null,
        provisionalEndDate: jobStatus === 'Provisional' ? (provisionalEndDate || null) : null,
      });
      if (res.success) {
        Alert.alert('Success', 'Employee updated successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Employee</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="John Doe"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Phone Number (10 digits)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="10-digit mobile number"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Department</Text>
          <TextInput
            style={styles.input}
            value={department}
            onChangeText={setDepartment}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Designation</Text>
          <TextInput
            style={styles.input}
            value={designation}
            onChangeText={setDesignation}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>System Roles * (Multi-select)</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleBtn, roles.includes('employee') && styles.toggleBtnActive]}
              onPress={() => {
                const next = roles.includes('employee')
                  ? roles.filter((r) => r !== 'employee')
                  : [...roles, 'employee'];
                if (next.length === 0) {
                  Alert.alert('Validation Error', 'At least one role must be selected.');
                  return;
                }
                setRoles(next);
              }}
            >
              <Text style={[styles.toggleText, roles.includes('employee') && styles.toggleTextActive]}>
                {roles.includes('employee') ? '✓ Employee' : 'Employee'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, roles.includes('admin') && styles.toggleBtnActive]}
              onPress={() => {
                const next = roles.includes('admin')
                  ? roles.filter((r) => r !== 'admin')
                  : [...roles, 'admin'];
                if (next.length === 0) {
                  Alert.alert('Validation Error', 'At least one role must be selected.');
                  return;
                }
                setRoles(next);
              }}
            >
              <Text style={[styles.toggleText, roles.includes('admin') && styles.toggleTextActive]}>
                {roles.includes('admin') ? '✓ Admin' : 'Admin'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Employment Job Status *</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleBtn, jobStatus === 'Permanent' && styles.toggleBtnActive]}
              onPress={() => setJobStatus('Permanent')}
            >
              <Text style={[styles.toggleText, jobStatus === 'Permanent' && styles.toggleTextActive]}>Permanent</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, jobStatus === 'Provisional' && styles.toggleBtnActive]}
              onPress={() => {
                setJobStatus('Provisional');
                if (!provisionalStartDate) setProvisionalStartDate(new Date().toISOString().substring(0, 10));
              }}
            >
              <Text style={[styles.toggleText, jobStatus === 'Provisional' && styles.toggleTextActive]}>Provisional</Text>
            </TouchableOpacity>
          </View>
        </View>

        {jobStatus === 'Provisional' && (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Provisional Start Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={provisionalStartDate}
                onChangeText={setProvisionalStartDate}
                placeholder="2026-09-11"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Provisional End Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={provisionalEndDate}
                onChangeText={setProvisionalEndDate}
                placeholder="2026-12-11"
              />
            </View>
          </>
        )}

        <TouchableOpacity 
          style={styles.submitButton}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollContainer: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#007bff',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  toggleTextActive: {
    color: '#fff',
  },
});
