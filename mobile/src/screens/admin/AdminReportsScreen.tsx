import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getAdminBaseUrl, getAdminAuthHeaders } from '../../api/adminApi';

export default function AdminReportsScreen({ navigation }: any) {
  const [loading, setLoading] = useState<string | null>(null);
  
  // Just hardcode simple selectors for now or use standard React Native picker
  // In a real app we'd use @react-native-picker/picker, but we'll use simple buttons for the demo
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const handleDownload = async (type: 'excel' | 'pdf') => {
    try {
      setLoading(type);
      const headers = await getAdminAuthHeaders();
      const API_URL = getAdminBaseUrl();
      const url = `${API_URL}/api/admin/reports/attendance?export=${type}&month=${month}&year=${year}`;
      
      const extension = type === 'excel' ? 'xlsx' : 'pdf';
      const fileUri = FileSystem.documentDirectory + `Falcon_Report_${year}_${month}.${extension}`;
      
      const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
        headers
      });

      if (downloadResult.status !== 200) {
        throw new Error('Server returned an error');
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: type === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
          dialogTitle: 'Share Attendance Report',
          UTI: type === 'excel' ? 'com.microsoft.excel.xls' : 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Success', `File saved to ${downloadResult.uri}`);
      }

    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'An error occurred while downloading.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export Reports</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Period</Text>
          
          <Text style={styles.label}>Month</Text>
          <View style={styles.monthGrid}>
            {months.map((m, index) => (
              <TouchableOpacity 
                key={m}
                style={[styles.monthBtn, month === index + 1 && styles.monthBtnActive]}
                onPress={() => setMonth(index + 1)}
              >
                <Text style={[styles.monthBtnText, month === index + 1 && styles.monthBtnTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Year</Text>
          <View style={styles.yearRow}>
            {[year - 1, year, year + 1].map((y) => (
              <TouchableOpacity 
                key={y}
                style={[styles.yearBtn, year === y && styles.yearBtnActive]}
                onPress={() => setYear(y)}
              >
                <Text style={[styles.yearBtnText, year === y && styles.yearBtnTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.downloadBtn, { backgroundColor: '#28a745' }]}
          onPress={() => handleDownload('excel')}
          disabled={loading !== null}
        >
          {loading === 'excel' ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="document-text" size={24} color="#fff" style={styles.btnIcon} />
              <Text style={styles.downloadBtnText}>Download Excel Report</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.downloadBtn, { backgroundColor: '#dc3545' }]}
          onPress={() => handleDownload('pdf')}
          disabled={loading !== null}
        >
          {loading === 'pdf' ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="document" size={24} color="#fff" style={styles.btnIcon} />
              <Text style={styles.downloadBtnText}>Download PDF Report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    marginTop: 10,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  monthBtn: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f3f5',
    alignItems: 'center',
  },
  monthBtnActive: {
    backgroundColor: '#007bff',
  },
  monthBtnText: {
    color: '#333',
    fontWeight: '500',
  },
  monthBtnTextActive: {
    color: '#fff',
  },
  yearRow: {
    flexDirection: 'row',
    gap: 15,
  },
  yearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f3f5',
    alignItems: 'center',
  },
  yearBtnActive: {
    backgroundColor: '#007bff',
  },
  yearBtnText: {
    color: '#333',
    fontWeight: '500',
  },
  yearBtnTextActive: {
    color: '#fff',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 15,
  },
  btnIcon: {
    marginRight: 10,
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
