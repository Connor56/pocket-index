# Holepunching Through NATs

Most devices on the internet sit behind Network Address Translation (NAT). A home router or mobile carrier rewrites private addresses so many machines share one public IP. That works for outbound browsing, but it breaks inbound peer-to-peer connections: another peer cannot simply dial your private `192.168.x.x` address, and the router may not forward unsolicited packets to you.

Holepunching (also called NAT traversal) is a technique where both peers send outbound packets toward each other’s public addresses at roughly the same time, often coordinated by a third party that already knows both sides. Those outbound packets open temporary mappings in each NAT. If the NATs are friendly enough, the return traffic is accepted and a direct UDP (or similar) path forms between the peers without either side configuring port forwarding.

In the Holepunch / HyperDHT world, the DHT and related relays help peers exchange address candidates and coordinate that simultaneous dial. When a direct punch succeeds, traffic stays peer-to-peer and low-latency. When it fails, connections can fall back to relays so the app still works. That combination is why Pear apps can connect across home networks and mobile NATs without users opening firewall ports by hand.
