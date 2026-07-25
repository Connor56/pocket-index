# Merkle Trees

A Merkle tree is a hash tree: leaf nodes hold hashes of data blocks, and each parent node is the hash of its children. The single hash at the top—the Merkle root—summarizes the entire dataset. If any leaf changes, every hash up to the root changes too, so the root is a compact fingerprint of all the data underneath.

Merkle trees are used whenever you need efficient integrity checks or proofs. In systems like Hypercore, each append updates the tree so peers can verify blocks against the signed root without downloading everything. A peer can also request a short Merkle proof that a specific block belongs to a claimed root, which is much cheaper than transferring the whole log just to check one piece.

They are helpful because verification scales well. You get tamper evidence from a small root hash, partial sync without trusting intermediaries blindly, and clear answers to “is this block part of that dataset?” That property underpins secure peer-to-peer replication: untrusted peers can still serve data, and cryptographic proofs show whether what they sent is genuine.
