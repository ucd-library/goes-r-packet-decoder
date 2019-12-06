
const SYNC = '1ACFFC1D'.toLowerCase();

module.exports = {
  // editable config
  config : {
    // how long to wait for the last fragement of an image to show up
    imageBlockBufferTimer : 20 * 1000,
    imageFragmentBufferTimer : 5 * 1000
  },

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
    HEADER_DEF : [
      {
        size: 16,
        headers : {
          H_FRAME_VERSION : {
            length : 2,
            mask : 0x3
          },
          H_SPACECRAFT_ID : {
            length : 8,
            mask : 0xff,
          },
          H_VIRTUAL_CHANNEL_ID : {
            length: 6,
            mask : 0x3f
          }
        }
      },
      {
        size: 32,
        headers : {
          H_VIRTUAL_CHANNEL_FRAME_COUNT : {
            length: 24,
            mask : 0xffffff
          },
          H_REPLAY_FLAG : {
            length: 1,
            mask: 0x1
          },
          H_VIRTUAL_CHANNEL_FRAME_COUNT_USAGE : {
            length: 1,
            mask : 0x1
          },
          H_RSVD_SPARE : {
            length: 2,
            mask : 0x3
          },
          H_VIRTUAL_CHANNEL_FRAME_COUNT_CYCLE : {
            length: 4,
            mask : 0xf
          }
        }
      }
    ]
  },

  // TRANSFER FRAME DATA FIELD
  M_PDU : {
    PACKET_LENGTH : 2036,

    DEF : {
      HEADER : 2,
      DATA : 2034
    },

    // IN BITS
    HEADER_DEF : [{
      size: 16,
      headers : {
        RSVD_SPARE : {
          length: 5,
          mask : 0x1f,
        },
        FIRST_HEADER_POINT : {
          length: 11,
          mask : 0x7ff
        }
      }
    }]
  },

  // SPACE PACKET
  SPACE_PACKET : {
    // VARIABLE PACKET LENGTH

    DEF : {
      PRIMARY_HEADER : 6,
      SECONDARY_HEADER : 8
    },

    PRIMARY_HEADER_DEF : [
      {
        size: 32,
        headers : {
          PACKET_VERSION_NUMBER : {
            length: 3,
            mask : 0x7
          },
          PACKET_TYPE : {
            length: 1,
            mask : 0x1
          },
          SECONDARY_HEADER_FLAG : {
            length : 1,
            mask : 0x1
          },
          APPLICATION_PROCESS_IDENTIFIER : {
            length: 11,
            mask : 0x7ff
          },
          SEQUENCE_FLAGS : {
            length: 2,
            mask : 0x3
          },
          PACKET_SEQUENCE_COUNT : {
            length: 14,
            mask: 0x3fff
          }
        }
      },
      {
        size: 16,
        headers : {
          PACKET_DATA_LENGTH : {
            length: 16,
            mask : 0xffff
          }
        }
      }
    ],

    SECONDARY_HEADER_DEF : [
      { 
        size: 16,
        headers : {
          DAYS_SINCE_THE_EPOCH : {
            length: 16,
            mask: 0xffff
          }
        }
      },
      {
        size: 32,
        headers : {
          MILLISECONDS_OF_THE_DAY : {
            length: 32,
            mask: 0xffffffff
          }
        }
      },
      // NOTE: these don't all line up with documentation, taking our best quess
      {
        size: 16,
        headers : {
          GRB_VERSION : {
            mask : 0x7,
            length: 5,
          },
          GRB_PAYLOAD_VARIANT : {
            length: 5,
            mask : 0x3
          },
          ASSEMBLER_IDENTIFIER : {
            length: 2,
            mask: 0x3
          },
          SYSTEM_ENVIRONMENT : {
            length: 4,
            mask : 0x3
          }
        }
      }
    ]
  },

  // IMAGE PAYLOAD
  IMAGE_PAYLOAD : {

    DEF : {
      HEADER : 34
    },

    // using bytes for this on
    HEADER_DEF : {
      COMPRESSION_ALGORITHM : 1,
      SECONDS_SINCE_EPOCH : 4,
      MICROSECOND_OF_SECOND : 4,
      IMAGE_BLOCK_SEQUENCE_COUNT : 2,
      ROW_OFFSET_WITH_IMAGE_BLOCK : 3,
      UPPER_LOWER_LEFT_X_COORDINATE : 4,
      UPPER_LOWER_LEFT_Y_COORDINATE : 4,
      IMAGE_BLOCK_HEIGHT : 4,
      IMAGE_BLOCK_WIDTH: 4,
      OCTET_OFFSET_TO_DQF_FRAGMENT: 4
    }
  },

  // GENERIC PAYLOAD
  GENERIC_PAYLOAD : {

    DEF : {
      HEADER : 21
    },

    // using bytes for this on
    HEADER_DEF : {
      COMPRESSION_ALGORITHM : 1,
      SECONDS_SINCE_EPOCH : 4,
      MICROSECOND_OF_SECOND : 4,
      RESERVED_1 : 4,
      RESERVED_2 : 4,
      DATA_UNIT_SEQUENCE_COUNT : 4
    }
  }
}