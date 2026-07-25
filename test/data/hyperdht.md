# HyperDHT

HyperDHT is a distributed hash table used for peer discovery and holepunching in the Holepunch ecosystem. Instead of asking a central directory “where is peer X?”, nodes store and look up small records in a Kademlia-style DHT keyed by public keys and topics. When you want to connect to someone, you query the DHT for that peer’s address hints and then attempt a direct connection.

You typically do not use HyperDHT alone for application traffic. Higher-level tools like Hyperswarm sit on top of it. You might use HyperDHT directly when you need custom discovery—announcing a service under a key, looking up mutable or immutable records, or building your own connection layer that still benefits from the same global peer network.

HyperDHT is helpful because discovery stays decentralized and resilient. There is no single server that has to know every peer, and the same network powers holepunching so peers behind NATs can often still reach each other. For Pear and related apps, it is the backbone that makes “find this key / join this topic” work across the internet.
