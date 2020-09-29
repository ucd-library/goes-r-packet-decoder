const Kafka = require('node-rdkafka');
const waitUtil = require('./wait-until');
const ensureTopic = require('./ensure-topic');

class Producer {

  constructor(kafkaConfig, topicConfig) {
    this.kafkaConfig = kafkaConfig;
    this.topicConfig = topicConfig;

    this.client = new Kafka.Producer(kafkaConfig);

    this.client
      .on('ready', () => console.log('Kafka producer ready'))
      .on('disconnected', e => console.log('Kafka producer disconnected', e))
      .on('event.error', e => console.error('Kafka producer event.error', e));
  }

  initTopic() {
    return ensureTopic(
      this.topicConfig, 
      {
        'metadata.broker.list': this.kafkaConfig['metadata.broker.list']
      }
    );
  }

  /**
   * @method connect
   * @description connect client
   * 
   * @param {Object} opts 
   */
  connect(opts={}) {
    return new Promise(async (resolve, reject) => {
      let [host, port] = this.kafkaConfig['metadata.broker.list'].split(':');
      await waitUtil(host, port);

      this.client.connect(opts, async (err, data) => {
        this.connected = true;
        this.client.setPollInterval(100);

        await this.initTopic();

        if( err ) reject(err);
        else resolve(data);
      });
    });
  }

  /**
   * @method disconnect
   * @description disconnect client
   * 
   * @param {Object} opts 
   */
  disconnect() {
    return new Promise((resolve, reject) => {
      this.client.disconnect((err, data) => {
        if( err ) reject(err);
        else resolve(data);
      });
    });
  }

  /**
   * @method produce
   * @description send message.  If message value is object it will be automatically turned
   * into JSON string.  If value is string, it will be automatically turned into Buffer.
   * Sets message timestamp to Date.now()
   * 
   * @param {Object} metadata
   * @param {Buffer} payload message payload
   */
  produce(metadata, payload) {
    let message = Buffer.from(JSON.stringify(metadata));
    let length = Buffer.alloc(4);
    length.writeInt32BE(message.length);

    if( payload ) {
      message = Buffer.concat([length, message, payload])
    } else {
      message = Buffer.concat([length, message])
    }

    this.client.produce(this.topicConfig.topic, null, message, 'goes-r-message', Date.now());
  }

}

module.exports = Producer;