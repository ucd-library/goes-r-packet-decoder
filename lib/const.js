
const SYNC = '1ACFFC1D'.toLowerCase();

module.exports = {
  // CHANNEL ACCESS DATA UNIT (CADU) – For GRB
  CADU : {
    SYNC : '1ACFFC1D',
    PACKET_LENGTH : 2048,
    // OCTETS
    DEF : {
      SYNC : 4,
      HEADER : 6,
      DATA : 2036,
      ERROR : 2
    },
    // HEADER (IN BITs)
    HEADER_DEF : {
      H_FRAME_VERSION : 2,
      H_SPACECRAFT_ID : 8,
      H_VIRTUAL_CHANNEL_ID : 6,
      H_VIRTUAL_CHANNEL_FRAME_COUNT : 24,
      H_REPLAY_FLAG : 1,
      H_VIRTUAL_CHANNEL_FRAME_COUNT_USAGE : 1,
      H_RSVD_SPARE : 2,
      H_VIRTUAL_CHANNEL_FRAME_COUNT_CYCLE : 4
    }
  },

  // TRANSFER FRAME DATA FIELD
  M_PDU : {
    PACKET_LENGTH : 2036,

    DEF : {
      HEADER : 2,
      DATA : 2034
    },

    // IN BITS
    HEADER_DEF : {
      RSVD_SPARE : 5,
      FIRST_HEADER_POINT : 11
    }
  },

  // SPACE PACKET
  SPACE_PACKET : {
    // VARIABLE PACKET LENGTH

    DEF : {
      PRIMARY_HEADER : 6,
      SECONDARY_HEADER : 8
    },

    PRIMARY_HEADER_DEF : {
      PACKET_VERSION_NUMBER : 3,
      PACKET_TYPE : 1,
      SECONDARY_HEADER_FLAG : 1,
      APPLICATION_PROCESS_IDENTIFIER : 11,
      SEQUENCE_FLAGS : 2,
      PACKET_SEQUENCE_COUNT : 14,
      PACKET_DATA_LENGTH : 16
    },

    SECONDARY_HEADER_DEF : {
      DAYS_SINCE_THE_EPOCH : 16,
      MILLISECONDS_OF_THE_DAY : 32,
      GRB_VERSION : 5,
      GRB_PAYLOAD_VARIANT : 5,
      ASSEMBLER_IDENTIFIER : 2,
      SYSTEM_ENVIRONMENT : 4
    }
  },

  // IMAGE PAYLOAD
  IMAGE_PAYLOAD : {

    DEF : {
      HEADER : 34
    },

    HEADER_DEF : {
      COMPRESSION_ALGORITHM : 8,
      SECONDS_SINCE_EPOCH : 32,
      MICROSECOND_OF_SECOND : 32,
      IMAGE_BLOCK_SEQUENCE_COUNT : 16,
      ROW_OFFSET_WITH_IMAGE_BLOCK : 24,
      UPPER_LOWER_LEFT_X_COORDINATE : 32,
      UPPER_LOWER_LEFT_Y_COORDINATE : 32,
      IMAGE_BLOCK_HEIGHT : 32,
      IMAGE_BLOCK_WIDTH: 32,
      OCTET_OFFSET_TO_DQF_FRAGMENT: 32
    }
  }
}