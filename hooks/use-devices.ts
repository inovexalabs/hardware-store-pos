'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  DEFAULT_DEVICE_SETTINGS,
  devicesSnapshot,
  readDeviceLog,
  readDeviceSettings,
  readDeviceStatus,
  subscribeDevices,
  type DeviceEvent,
  type DeviceSettings,
  type DeviceStatus,
} from '@/lib/devices';
import {
  connectionSnapshot,
  describeConnection,
  readConnections,
  type DeviceConnection,
  type DeviceKind,
} from '@/lib/device-connection';

interface DevicesState {
  /** false during server render / first paint, before this browser's settings are read */
  ready: boolean;
  settings: DeviceSettings;
  status: DeviceStatus;
  log: DeviceEvent[];
  /** plugged in / unplugged / unknown, per device */
  connections: Record<DeviceKind, DeviceConnection>;
}

const NOTHING = { link: undefined, present: null, seen: false, check: null, version: 0 };

const SERVER: DevicesState = {
  ready: false,
  settings: DEFAULT_DEVICE_SETTINGS,
  status: { scanner: null, printer: null },
  log: [],
  connections: {
    scanner: describeConnection('scanner', NOTHING),
    printer: describeConnection('printer', NOTHING),
  },
};

function snapshot(): string {
  return `${devicesSnapshot()}\u0001${connectionSnapshot()}`;
}

/** This computer's scanner/printer settings, connection, last checks and device log (live-updating). */
export function useDevices(): DevicesState {
  const key = useSyncExternalStore(subscribeDevices, snapshot, () => null);
  return useMemo(() => {
    if (key === null) return SERVER;
    const status = readDeviceStatus();
    return {
      ready: true,
      settings: readDeviceSettings(),
      status,
      log: readDeviceLog(),
      connections: readConnections(status),
    };
  }, [key]);
}
