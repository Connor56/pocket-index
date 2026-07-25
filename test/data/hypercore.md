# Hypercore

Hypercore is an append-only log of binary blocks, identified by a public key and secured with a Merkle tree. The owner of the corresponding private key can append new blocks; anyone else can replicate the log and cryptographically verify that every block belongs to that core. Blocks are addressed by index, so Hypercore behaves like a secure, syncable array of buffers that grows over time.

You use Hypercore as a primitive building block rather than as a full application database. Higher-level tools—Hyperbee (a key/value store), Hyperdrive (a filesystem), Autobase (multiwriter collaboration)—are built on cores. In an app you create or load a core, append data as you produce it, and replicate with peers so they receive the same verified sequence.

Hypercore is helpful because replication and integrity travel together. Peers can download only the blocks they need, verify them against the Merkle root, and trust they have not been tampered with—even when data comes from untrusted peers. That makes it a solid foundation for offline-first, peer-to-peer data without a central source of truth for every byte.
