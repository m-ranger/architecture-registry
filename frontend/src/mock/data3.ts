import type { NetworkZone, NetworkSegment, NetworkInterface } from '../types'

export const networkZones: NetworkZone[] = [
  { id: 'zone-dmz', code: 'DMZ', name: 'Demilitarized Zone', zoneType: 'DMZ', securityLevel: 'HIGH', status: 'ACTIVE' },
  { id: 'zone-lan', code: 'LAN', name: 'Internal LAN', zoneType: 'INTERNAL', securityLevel: 'MEDIUM', status: 'ACTIVE' },
  { id: 'zone-pci', code: 'PCI', name: 'PCI DSS Zone', zoneType: 'PCI_DSS', securityLevel: 'CRITICAL', parentId: 'zone-lan', status: 'ACTIVE' },
  { id: 'zone-mgmt', code: 'MANAGEMENT', name: 'Management Zone', zoneType: 'MANAGEMENT', securityLevel: 'HIGH', status: 'ACTIVE' },
  { id: 'zone-ext', code: 'EXTERNAL', name: 'External', zoneType: 'EXTERNAL', securityLevel: 'LOW', status: 'ACTIVE' },
]

export const networkSegments: NetworkSegment[] = [
  { id: 'seg-dmz-app', networkZoneId: 'zone-dmz', code: 'DMZ-APP', name: 'DMZ Application Segment', cidr: '10.20.10.0/24', vlan: 210, purpose: 'Internet Banking DMZ', status: 'ACTIVE' },
  { id: 'seg-dmz-mgmt', networkZoneId: 'zone-dmz', code: 'DMZ-MGMT', name: 'DMZ Management Segment', cidr: '10.20.20.0/24', vlan: 220, status: 'ACTIVE' },
  { id: 'seg-lan-app', networkZoneId: 'zone-lan', code: 'LAN-APP', name: 'LAN Application Segment', cidr: '10.10.10.0/24', vlan: 110, purpose: 'Internal services', status: 'ACTIVE' },
  { id: 'seg-lan-db', networkZoneId: 'zone-lan', code: 'LAN-DB', name: 'LAN Database Segment', cidr: '10.10.30.0/24', vlan: 130, purpose: 'Database VLAN', status: 'ACTIVE' },
  { id: 'seg-mgmt', networkZoneId: 'zone-mgmt', code: 'MGMT-01', name: 'Management Segment', cidr: '10.99.1.0/24', vlan: 99, status: 'ACTIVE' },
  { id: 'seg-pci', networkZoneId: 'zone-pci', code: 'PCI-APP', name: 'PCI Application Segment', cidr: '10.40.10.0/24', vlan: 410, purpose: 'Card transaction processing', status: 'ACTIVE' },
]

export const networkInterfaces: NetworkInterface[] = [
  { id: 'nic-ib-01-eth0', serverId: 'srv-ib-01', networkSegmentId: 'seg-dmz-app', name: 'eth0', ipAddress: '10.20.10.15', macAddress: '52:54:00:11:22:33', interfaceRole: 'PRIMARY', status: 'ACTIVE' },
  { id: 'nic-ib-01-mgmt', serverId: 'srv-ib-01', networkSegmentId: 'seg-dmz-mgmt', name: 'mgmt0', ipAddress: '10.20.20.11', interfaceRole: 'MANAGEMENT', status: 'ACTIVE' },
  { id: 'nic-ib-02-eth0', serverId: 'srv-ib-02', networkSegmentId: 'seg-dmz-app', name: 'eth0', ipAddress: '10.20.10.16', interfaceRole: 'PRIMARY', status: 'ACTIVE' },
  { id: 'nic-cust-01-eth0', serverId: 'srv-cust-01', networkSegmentId: 'seg-lan-app', name: 'eth0', ipAddress: '10.10.10.25', status: 'ACTIVE' },
  { id: 'nic-cust-db-eth0', serverId: 'srv-cust-02', networkSegmentId: 'seg-lan-db', name: 'eth0', ipAddress: '10.10.30.11', status: 'ACTIVE' },
  { id: 'nic-core-adapter', serverId: 'srv-core-01', networkSegmentId: 'seg-lan-app', name: 'eth0', ipAddress: '10.10.10.42', status: 'ACTIVE' },
  { id: 'nic-core-db-01', serverId: 'srv-core-02', networkSegmentId: 'seg-lan-db', name: 'eth0', ipAddress: '10.10.30.42', status: 'ACTIVE' },
  { id: 'nic-fw01-dmz', firewallId: 'fw-01', networkSegmentId: 'seg-dmz-app', name: 'interface-01', interfaceRole: 'INSIDE', status: 'ACTIVE' },
  { id: 'nic-fw01-lan', firewallId: 'fw-01', networkSegmentId: 'seg-lan-app', name: 'interface-02', interfaceRole: 'OUTSIDE', status: 'ACTIVE' },
  { id: 'nic-rtr01-dmz', routerId: 'rtr-01', networkSegmentId: 'seg-dmz-app', name: 'ge-0/0/0', status: 'ACTIVE' },
  { id: 'nic-rtr01-lan', routerId: 'rtr-01', networkSegmentId: 'seg-lan-app', name: 'ge-0/0/1', status: 'ACTIVE' },
]
