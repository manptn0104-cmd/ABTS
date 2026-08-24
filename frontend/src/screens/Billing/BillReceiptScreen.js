import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { getBill, downloadReceipt } from '../../api/bills';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';

export default function BillReceiptScreen({ navigation }) {
  const route = useRoute();
  const { billId } = route.params || {};

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadBill();
  }, [billId]);

  const loadBill = async () => {
    if (!billId) {
      Alert.alert('Error', 'Bill ID is required');
      navigation.goBack();
      return;
    }

    setLoading(true);
    try {
      const res = await getBill(billId);
      if (res.data.success) {
        setBill(res.data.bill);
      } else {
        Alert.alert('Error', res.data.message || 'Failed to load bill');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load bill. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const res = await downloadReceipt(billId);
      if (res.data.success) {
        Alert.alert('Success', 'Receipt data downloaded. PDF generation will be implemented.');
        // In production, use react-native-pdf or expo-print to generate actual PDF
      } else {
        Alert.alert('Error', res.data.message || 'Failed to download receipt');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to download receipt');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!bill) return;

    const message = `
ABTS - Ambulance Booking & Tracking System
Receipt Number: ${bill.receiptNumber}
Date: ${new Date(bill.createdAt).toLocaleDateString()}

Patient: ${bill.patientName}
Driver: ${bill.driverName}
Ambulance: ${bill.ambulanceNumber}

Pickup: ${bill.pickupAddress}
Drop: ${bill.dropAddress}
Distance: ${bill.rideDistanceKm} km

Total Amount: ₹${bill.totalAmount.toFixed(2)}
Payment Method: ${bill.paymentMethod.toUpperCase()}
Payment Status: ${bill.paymentStatus.toUpperCase()}
    `.trim();

    try {
      await Share.share({
        message,
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  const formatCurrency = (amount) => `₹${amount.toFixed(2)}`;

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#2E7D32';
      case 'pending': return '#F57F17';
      case 'failed': return '#B71C1C';
      case 'refunded': return '#1565C0';
      default: return '#757575';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bill) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="receipt" size={64} color={Colors.textMuted} />
          <Text style={styles.errorText}>Bill not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="ambulance" size={40} color={Colors.primary} />
            <Text style={styles.logoText}>ABTS</Text>
          </View>
          <Text style={styles.headerTitle}>Payment Receipt</Text>
        </View>

        {/* Receipt Card */}
        <View style={styles.receiptCard}>
          {/* Receipt Number & Date */}
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Receipt Number</Text>
              <Text style={styles.value}>{bill.receiptNumber}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{new Date(bill.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Booking ID */}
          <View style={styles.row}>
            <Text style={styles.label}>Booking ID</Text>
            <Text style={styles.value}>{bill.bookingId?._id || 'N/A'}</Text>
          </View>

          <View style={styles.divider} />

          {/* Patient Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{bill.patientName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Driver Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{bill.driverName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Ambulance Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ambulance Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Vehicle Number</Text>
              <Text style={styles.value}>{bill.ambulanceNumber}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Ride Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ride Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Pickup</Text>
              <Text style={styles.valueRight}>{bill.pickupAddress}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Drop</Text>
              <Text style={styles.valueRight}>{bill.dropAddress}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Distance</Text>
              <Text style={styles.value}>{bill.rideDistanceKm} km</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Pricing Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing Breakdown</Text>
            
            <View style={styles.row}>
              <Text style={styles.label}>Base Fare</Text>
              <Text style={styles.value}>{formatCurrency(bill.baseFare)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Price per KM</Text>
              <Text style={styles.value}>{formatCurrency(bill.pricePerKm)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Distance Charge</Text>
              <Text style={styles.value}>{formatCurrency(bill.distanceCharge)}</Text>
            </View>

            {/* Facility Charges */}
            {(bill.oxygenCharge > 0 || bill.salineCharge > 0 || bill.stretcherCharge > 0 ||
              bill.nurseCharge > 0 || bill.doctorCharge > 0 || bill.ventilatorCharge > 0 ||
              bill.defibrillatorCharge > 0) && (
              <>
                <View style={styles.subDivider} />
                <Text style={styles.subSectionTitle}>Facility Charges</Text>
                
                {bill.oxygenCharge > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Oxygen</Text>
                    <Text style={styles.value}>{formatCurrency(bill.oxygenCharge)}</Text>
                  </View>
                )}
                {bill.salineCharge > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Saline</Text>
                    <Text style={styles.value}>{formatCurrency(bill.salineCharge)}</Text>
                  </View>
                )}
                {bill.stretcherCharge > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Stretcher</Text>
                    <Text style={styles.value}>{formatCurrency(bill.stretcherCharge)}</Text>
                  </View>
                )}
                {bill.nurseCharge > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Nurse</Text>
                    <Text style={styles.value}>{formatCurrency(bill.nurseCharge)}</Text>
                  </View>
                )}
                {bill.doctorCharge > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Doctor</Text>
                    <Text style={styles.value}>{formatCurrency(bill.doctorCharge)}</Text>
                  </View>
                )}
                {bill.ventilatorCharge > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Ventilator</Text>
                    <Text style={styles.value}>{formatCurrency(bill.ventilatorCharge)}</Text>
                  </View>
                )}
                {bill.defibrillatorCharge > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Defibrillator</Text>
                    <Text style={styles.value}>{formatCurrency(bill.defibrillatorCharge)}</Text>
                  </View>
                )}
              </>
            )}

            {/* Other Charges */}
            {(bill.waitingCharge > 0 || bill.tollCharge > 0) && (
              <>
                <View style={styles.subDivider} />
                <Text style={styles.subSectionTitle}>Other Charges</Text>
                
                {bill.waitingCharge > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Waiting Charge</Text>
                    <Text style={styles.value}>{formatCurrency(bill.waitingCharge)}</Text>
                  </View>
                )}
                {bill.tollCharge > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Toll Charge</Text>
                    <Text style={styles.value}>{formatCurrency(bill.tollCharge)}</Text>
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.divider} />

          {/* Totals */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.label}>Subtotal</Text>
              <Text style={styles.value}>{formatCurrency(bill.subtotal)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>GST ({bill.gstPercentage}%)</Text>
              <Text style={styles.value}>{formatCurrency(bill.gst)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(bill.totalAmount)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Payment Info */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.label}>Payment Method</Text>
              <Text style={styles.value}>{bill.paymentMethod.toUpperCase()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Payment Status</Text>
              <Text style={[styles.value, { color: getPaymentStatusColor(bill.paymentStatus) }]}>
                {bill.paymentStatus.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.downloadButton]}
            onPress={handleDownloadPDF}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="download" size={20} color="#fff" />
                <Text style={styles.buttonText}>Download PDF</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={handleShare}
          >
            <MaterialCommunityIcons name="share" size={20} color="#fff" />
            <Text style={styles.buttonText}>Share Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.homeButton]}
            onPress={() => navigation.navigate('Home')}
          >
            <MaterialCommunityIcons name="home" size={20} color="#fff" />
            <Text style={styles.buttonText}>Back Home</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.textMuted,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: 18,
    color: Colors.text,
  },
  backButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    color: Colors.white,
    fontWeight: '600',
  },
  receiptCard: {
    backgroundColor: Colors.white,
    margin: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.medium,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  valueRight: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  subDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  section: {
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  buttonContainer: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  downloadButton: {
    backgroundColor: Colors.primary,
  },
  shareButton: {
    backgroundColor: '#1976D2',
  },
  homeButton: {
    backgroundColor: Colors.text,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
