import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { createEmployee } from '../../api/adminApi';

export default function AddEmployeeScreen({ navigation, route }: any) {
  const [formData, setFormData] = useState({
    customEmployeeId: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    department: '',
    designation: '',
    role: 'employee',
    roles: ['employee'],
    jobStatus: 'Permanent',
    provisionalStartDate: '',
    provisionalEndDate: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
      Alert.alert('Validation Error', 'Name and Email are required.');
      return;
    }

    try {
      setLoading(true);
      const res = await createEmployee(formData);
      if (res.success) {
        Alert.alert(
          'Employee Created!',
          `Employee ID: ${res.data.employeeId}\nPassword: ${res.data.tempPassword}\n\nPlease save this password.`,
          [
            { 
              text: 'OK', 
              onPress: () => {
                if (route.params?.onGoBack) {
                  route.params.onGoBack();
                }
                navigation.goBack();
              }
            }
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add New Employee</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Custom Employee ID / Username (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Leave blank to auto-generate"
          value={formData.customEmployeeId}
          autoCapitalize="none"
          onChangeText={(text) => setFormData({ ...formData, customEmployeeId: text })}
        />

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="John Doe"
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
        />

        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="john@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
        />

        <Text style={styles.label}>Password (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Leave blank to auto-generate"
          secureTextEntry
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
        />

        <Text style={styles.label}>Phone Number (10 digits)</Text>
        <TextInput
          style={styles.input}
          placeholder="10-digit mobile number"
          keyboardType="number-pad"
          maxLength={10}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text.replace(/\D/g, '').slice(0, 10) })}
        />

        <Text style={styles.label}>Department</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Engineering"
          value={formData.department}
          onChangeText={(text) => setFormData({ ...formData, department: text })}
        />

        <Text style={styles.label}>Designation</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Software Engineer"
          value={formData.designation}
          onChangeText={(text) => setFormData({ ...formData, designation: text })}
        />

        <Text style={styles.label}>System Roles * (Multi-select)</Text>
        <View style={styles.roleContainer}>
          <TouchableOpacity 
            style={[styles.roleButton, formData.roles.includes('employee') && styles.roleButtonActive]}
            onPress={() => {
              const next = formData.roles.includes('employee')
                ? formData.roles.filter((r) => r !== 'employee')
                : [...formData.roles, 'employee'];
              if (next.length === 0) {
                Alert.alert('Validation Error', 'At least one role must be selected.');
                return;
              }
              setFormData({ ...formData, roles: next, role: next.includes('admin') ? 'admin' : 'employee' });
            }}
          >
            <Text style={[styles.roleText, formData.roles.includes('employee') && styles.roleTextActive]}>
              {formData.roles.includes('employee') ? '✓ Employee' : 'Employee'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleButton, formData.roles.includes('admin') && styles.roleButtonActive]}
            onPress={() => {
              const next = formData.roles.includes('admin')
                ? formData.roles.filter((r) => r !== 'admin')
                : [...formData.roles, 'admin'];
              if (next.length === 0) {
                Alert.alert('Validation Error', 'At least one role must be selected.');
                return;
              }
              setFormData({ ...formData, roles: next, role: next.includes('admin') ? 'admin' : 'employee' });
            }}
          >
            <Text style={[styles.roleText, formData.roles.includes('admin') && styles.roleTextActive]}>
              {formData.roles.includes('admin') ? '✓ Admin' : 'Admin'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Employment Job Status *</Text>
        <View style={styles.roleContainer}>
          <TouchableOpacity 
            style={[styles.roleButton, formData.jobStatus === 'Permanent' && styles.roleButtonActive]}
            onPress={() => setFormData({ ...formData, jobStatus: 'Permanent' })}
          >
            <Text style={[styles.roleText, formData.jobStatus === 'Permanent' && styles.roleTextActive]}>Permanent</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleButton, formData.jobStatus === 'Provisional' && styles.roleButtonActive]}
            onPress={() => setFormData({ 
              ...formData, 
              jobStatus: 'Provisional',
              provisionalStartDate: formData.provisionalStartDate || new Date().toISOString().substring(0, 10)
            })}
          >
            <Text style={[styles.roleText, formData.jobStatus === 'Provisional' && styles.roleTextActive]}>Provisional</Text>
          </TouchableOpacity>
        </View>

        {formData.jobStatus === 'Provisional' && (
          <>
            <Text style={styles.label}>Provisional Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026-09-11"
              value={formData.provisionalStartDate}
              onChangeText={(text) => setFormData({ ...formData, provisionalStartDate: text })}
            />

            <Text style={styles.label}>Provisional End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026-12-11"
              value={formData.provisionalEndDate}
              onChangeText={(text) => setFormData({ ...formData, provisionalEndDate: text })}
            />
          </>
        )}

        <TouchableOpacity 
          style={styles.submitButton} 
          onPress={handleSubmit} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  roleContainer: {
    flexDirection: 'row',
    marginTop: 5,
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  roleText: {
    color: '#333',
    fontWeight: 'bold',
  },
  roleTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
