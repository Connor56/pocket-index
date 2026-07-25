# Hyperswarm

Hyperswarm is a high-level peer discovery and connection library built on top of the Holepunch stack. It lets applications find other peers that share a common topic and establish encrypted connections between them, without needing a central server to broker every link. You join a topic (a 32-byte key), announce yourself if you want to be found, and Hyperswarm handles looking up peers and opening streams to them.

In practice you use Hyperswarm when your app needs many-to-many connectivity: chat rooms, collaborative documents, file sharing, or any swarm of nodes that should find each other by interest rather than by IP address. You create a Swarm instance, join a topic, and listen for connection events; each connection is a duplex stream you can read from and write to like a normal socket.

Hyperswarm is helpful because it hides the hard parts of decentralized networking. Discovery goes through HyperDHT, NAT traversal is attempted automatically, and connections are encrypted end-to-end. That means you can ship peer-to-peer features without standing up matchmaking servers or teaching users about ports and firewalls.
