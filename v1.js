const fs = require('fs-extra');
const ConvertBase = require('./lib/convert');

const SYNC = '1ACFFC1D'.toLowerCase();

// MAIN PACKET
// IN HEX LENGTH
const PACKET_LENGTH = 2048*2;
const SYNC_LENGTH = 4*2;
const HEADER_LENGTH = 6*2;
const DATA_LENGTH = 2036*2;
const ERROR_LENGTH = 2*2;

// HEADER (IN BIT LENGTH)
const H_FRAME_VERSION = 2;
const H_SPACECRAFT_ID = 8;
const H_VIRTUAL_CHANNEL_ID = 6;
const H_VIRTUAL_CHANNEL_FRAME_COUNT = 24;
const H_REPLAY_FLAG = 1;
const H_VIRTUAL_CHANNEL_FRAME_COUNT_USAGE = 1;
const H_RSVD_SPARE = 2;
const H_VIRTUAL_CHANNEL_FRAME_COUNT_CYCLE = 4;

const HEADER_DEF = {
  H_FRAME_VERSION,
  H_SPACECRAFT_ID,
  H_VIRTUAL_CHANNEL_ID,
  H_VIRTUAL_CHANNEL_FRAME_COUNT ,
  H_REPLAY_FLAG,
  H_VIRTUAL_CHANNEL_FRAME_COUNT_USAGE,
  H_RSVD_SPARE,
  H_VIRTUAL_CHANNEL_FRAME_COUNT_CYCLE,
}

const PACKET_DEF = {
  sync : SYNC_LENGTH,
  header : HEADER_LENGTH,
  data : DATA_LENGTH,
  error : ERROR_LENGTH
}

// TRANSFER FRAME DATA FIELD
const M_PDU_HEADER = {
  RSVD_SPARE : 5,
  FIRST_HEADER_POINT : 11
}

// SPACE PACKET
const SPACE_PACKET_PRIMARY_HEADER = {
  PACKET_VERSION_NUMBER : 3,
  PACKET_TYPE : 1,
  SECONDARY_HEADER_FLAG : 1,
  APPLICATION_PROCESS_IDENTIFIER : 11,
  SEQUENCE_FLAGS : 2,
  PACKET_SEQUENCE_COUNT : 14,
  PACKET_DATA_LENGTH : 16
}

const SPACE_PACKET_SECONDARY_HEADER = {
  DAYS_SINCE_THE_EPOCH : 16,
  MILLISECONDS_OF_THE_DAY : 32,
  GRB_VERSION : 5,
  GRB_PAYLOAD_VARIANT : 5,
  ASSEMBLER_IDENTIFIER : 2,
  SYSTEM_ENVIRONMENT : 4
}

let spacePacket = {};

async function run() {
  let content = await fs.readFile('subgrabpackets.dat');
  content = content.toString('hex');
  
  let index = content.indexOf(SYNC);
  let packets = [];
  while( index < content.length ) {
    packets.push(readPacket(index, content));
    index += PACKET_LENGTH;
    if( packets.length === 3 ) break;
  }

  packets.forEach(packet => console.log(JSON.stringify(packet, '  ', '  ')));
  console.log(packets.length);


}

function readPacket(start, content) {
  let raw = content.substr(start, PACKET_LENGTH);


  let index = 0;
  let packet = {};
  for( let key in PACKET_DEF ) {
    packet[key] = raw.substr(index, PACKET_DEF[key]);
    index += PACKET_DEF[key];
  }
  packet.dataLength = packet.data.length;

  setHeaderData(packet);
  readMPDUHeader(packet);
  readSpacePacket(packet);

  if( packet.sync !== SYNC ) {
    throw new Error('Invalid SYNC value: '+p.sync+' @ '+start);
  }

  return packet;
}

function setHeaderData(packet) {
  let header = Buffer.from(packet.header, 'hex').readUIntBE(0, 6);
  let headerValues = {};
  let index = 0;
  for( let key in HEADER_DEF ) {
    // console.log(key);
    headerValues[key] = readHeaderValue(header, index, HEADER_DEF[key]);
    index += HEADER_DEF[key];
  }

  packet.headerValues = headerValues;
}

function readHeaderValue(header, start, offset, hlb) {
  let hbl = hlb || HEADER_LENGTH*4;
  let mask = getMask(start, offset, hbl);

  let stBinHeader = ConvertBase.dec2bin(header);
  let stBinMask = ConvertBase.dec2bin(mask);
  while( stBinHeader.length < hbl ) stBinHeader = '0'+stBinHeader;
  while( stBinMask.length < hbl ) stBinMask = '0'+stBinMask;

  stBinHeader = stBinHeader.substr(start, offset);
  stBinMask = stBinMask.substr(start, offset);

  header = ConvertBase.bin2dec(stBinHeader);
  mask = ConvertBase.bin2dec(stBinMask);

  return header & mask; 
}

function readMPDUHeader(packet) {
  let hln = 16;

  packet.M_PDU_HEADER_HEX = packet.data.substr(0,4);
  let raw = parseInt('0x'+packet.M_PDU_HEADER_HEX);

  let index = 0;
  let header = {};
  for( let key in M_PDU_HEADER ) {
    let mask = getMask(index, M_PDU_HEADER[key], hln);
    let value = raw & mask;
    // console.log(key, ConvertBase.dec2bin(raw), ConvertBase.dec2bin(mask), ConvertBase.dec2bin(value));
    header[key] = value >>> (hln - M_PDU_HEADER[key] - index);
    index += M_PDU_HEADER[key];
  }
  
  packet.M_PDU_HEADER = header;
}

function readSpacePacket(packet, startIndex) {
  if( spacePacket && spacePacket.DATA_OVERFLOW ) {
    spacePacket.DATA += packet.data.substr(4, spacePacket.DATA_OVERFLOW);
    spacePacket.DATA_LENGTH = spacePacket.DATA.length;
  }

  // first point + header
  if( !startIndex ) {
    startIndex = (packet.M_PDU_HEADER.FIRST_HEADER_POINT*2) + 4;
  }
  if( !packet.spacePackets ) packet.spacePackets = [];

  spacePacket = {};
  packet.spacePackets.push(spacePacket);

  let headerLengthHex = 12;
  spacePacket.SPACE_PACKET_PRIMARY_HEADER_HEX = packet.data.substr(startIndex, headerLengthHex);
  let header = Buffer.from(spacePacket.SPACE_PACKET_PRIMARY_HEADER_HEX, 'hex').readUIntBE(0, 6);


  let headerValues = {};
  let index = 0;
  for( let key in SPACE_PACKET_PRIMARY_HEADER ) {
    headerValues[key] = readHeaderValue(header, index, SPACE_PACKET_PRIMARY_HEADER[key]);
    index += SPACE_PACKET_PRIMARY_HEADER[key];
  }

  spacePacket.SPACE_PACKET_PRIMARY_HEADER = headerValues;

  // start of space packet + primary header + secondary header
  let dataStart = startIndex + headerLengthHex + (8*2);

  // https://www.goes-r.gov/users/docs/PUG-GRB-vol4.pdf
  // see section 4.5.1 Primary Header Data Fields
  // under Packet Data Length
  // "This 16 bit field contains the size in octets of the Packet less the size of the Packet Primary Header plus one"
  // thus where the space packet started + header length + this random unexplained 1 byte plus the Packet Data Length
  let dataEnd = startIndex + headerLengthHex + 2 + (headerValues.PACKET_DATA_LENGTH * 2);
  spacePacket.SPACE_PACKET_START = startIndex;
  spacePacket.SPACE_PACKET_DATA_START = dataStart;
  spacePacket.SPACE_PACKET_DATA_END = dataEnd;

  readSpacePacketSecondaryHeader(packet, spacePacket, startIndex);

  if( dataEnd > packet.data.length ) {
    spacePacket.DATA_OVERFLOW = dataEnd - packet.data.length;
    spacePacket.DATA = packet.data.substr(spacePacket.SPACE_PACKET_START + headerLengthHex, packet.data.length - spacePacket.DATA_OVERFLOW);
  } else {
    spacePacket.DATA = packet.data.substr(spacePacket.SPACE_PACKET_START + headerLengthHex, dataEnd);
    spacePacket.DATA_LENGTH = spacePacket.DATA.length;
    readSpacePacket(packet, spacePacket.SPACE_PACKET_DATA_END);
  }
}

function readSpacePacketSecondaryHeader(packet, spacePacket={}, startIndex) {
  if( !startIndex ) {
    startIndex = (packet.M_PDU_HEADER.FIRST_HEADER_POINT*2) + 4;
  }
  startIndex += 12;

  let headerLengthHex = 8*2;
  spacePacket.SPACE_PACKET_SECONARY_HEADER_HEX = packet.data.substr(startIndex, headerLengthHex);

  let headerValues = {};

  // we have to split this up, greater than 48 bits :(
  let header = packet.data.substr(startIndex, 4);
  header = Buffer.from(header, 'hex').readUIntBE(0, 2);
  headerValues['DAYS_SINCE_THE_EPOCH'] = readHeaderValue(header, 0, SPACE_PACKET_SECONDARY_HEADER.DAYS_SINCE_THE_EPOCH, 2);
  
  // now read the rest
  header = packet.data.substr(startIndex+4, 12);
  header = Buffer.from(header, 'hex').readUIntBE(0, 6);

  let index = 0;
  for( let key in SPACE_PACKET_SECONDARY_HEADER ) {
    if( key === 'DAYS_SINCE_THE_EPOCH' ) continue;
    headerValues[key] = readHeaderValue(header, index, SPACE_PACKET_SECONDARY_HEADER[key]);
    index += SPACE_PACKET_SECONDARY_HEADER[key];
  }

  spacePacket.SPACE_PACKET_SECONDARY_HEADER = headerValues;
}

function getMask(start, offset, length) {
  let v = '';
  for( var i = 0; i < start; i++ ) v += '0';
  for( var i = 0; i < offset; i++ ) v += '1';
  for( var i = 0; i < length-offset-start; i++ ) v += '0';

  let hex = ConvertBase.bin2hex(v);
  return parseInt('0x'+hex);
}

run();