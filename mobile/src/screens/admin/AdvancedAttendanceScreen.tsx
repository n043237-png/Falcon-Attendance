import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { CustomAlert as Alert } from '../../components/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import { getAdminAttendance } from '../../api/adminApi';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AdvancedAttendanceScreen({ navigation }: any) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [date, status]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const data = await getAdminAttendance(dateStr, search, status);
      setRecords(data.items || []);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to fetch attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.employeeName}</Text>
        <View style={[styles.statusBadge, { 
          backgroundColor: item.status === 'PRESENT' ? '#d4edda' : 
                           item.status === 'ABSENT' ? '#f8d7da' : 
                           item.status === 'LATE' ? '#fff3cd' : '#d1ecf1'
        }]}>
          <Text style={[styles.statusText, { 
            color: item.status === 'PRESENT' ? '#155724' : 
                   item.status === 'ABSENT' ? '#721c24' : 
                   item.status === 'LATE' ? '#856404' : '#0c5460'
          }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.subText}>ID: {item.employeeId}</Text>
      
      <View style={styles.timeRow}>
        <View>
          <Text style={styles.timeLabel}>Check In</Text>
          <Text style={styles.timeValue}>{formatTime(item.checkIn)}</Text>
        </View>
        <View>
          <Text style={styles.timeLabel}>Check Out</Text>
          <Text style={styles.timeValue}>{formatTime(item.checkOut)}</Text>
        </View>
        <View>
          <Text style={styles.timeLabel}>Total Hours</Text>
          <Text style={styles.timeValue}>
            {Math.floor((item.workingMinutes || 0) / 60)}h {(item.workingMinutes || 0) % 60}m
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Advanced Attendance</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filters}>
        <TouchableOpacity 
          style={styles.datePickerBtn}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#333" />
          <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
        </TouchableOpacity>
        
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or ID..."
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchRecords}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={fetchRecords}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item, index) => item.attendanceId?.toString() || index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No records found.</Text>
          }
        />
      )}
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
  filters: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  dateText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f1f3f5',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  searchBtn: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
  },
  list: {
    padding: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
    paddingTop: 10,
  },
  timeLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  loader: {
    marginTop: 50,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 50,
    fontSize: 16,
  }
});
