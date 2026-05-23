export const DRIVER_STATUS = {
  offline: { label: 'Offline', color: '#757575' },
  online: { label: 'Online', color: '#2E7D32' },
  busy: { label: 'Busy', color: '#FF8F00' },
  on_trip: { label: 'On Trip', color: '#1565C0' },
  inactive: { label: 'Inactive', color: '#B71C1C' },
};

export const getDriverStatusStyle = (status) =>
  DRIVER_STATUS[status] || DRIVER_STATUS.offline;
