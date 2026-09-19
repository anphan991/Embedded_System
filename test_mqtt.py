import paho.mqtt.client as mqtt
import json
c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
c.connect('localhost')
c.publish('embedded/radar/data', json.dumps({"x": 2.5, "y": 3.0, "speed": 0.5}))
