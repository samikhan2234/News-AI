import type { SamplePaper } from "../types";

export const SAMPLE_PAPERS: SamplePaper[] = [
  {
    id: "transformer-attention",
    title: "Attention Is All You Need",
    authorsAndYear: "Vaswani et al. · NeurIPS 2017",
    discipline: "Machine Learning",
    excerpt: `Title: Attention Is All You Need (Transformer Architecture)

Abstract & Core Excerpt:
Dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. Recurrent models factor computation along the symbol positions of the input and output sequences, generating a sequence of hidden states h_t as a function of the previous hidden state h_{t-1} and the input for position t. This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths as memory constraints limit batching across examples.

We propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output. The Transformer allows for significantly more parallelization and reaches a new state of the art in translation quality after being trained for as little as twelve hours on eight P100 GPUs.

Scaled Dot-Product Attention computes attention weights from Queries (Q), Keys (K), and Values (V) of dimension d_k and d_v:
Attention(Q, K, V) = softmax((Q K^T) / sqrt(d_k)) V
We divide the dot products by sqrt(d_k) because for large values of d_k, dot products grow large in magnitude, pushing the softmax function into regions where it has extremely small gradients.

Multi-Head Attention projects Q, K, and V linearly h=8 times with different learned projections to d_k = d_v = d_model / h = 64 dimensions, allowing the model to jointly attend to information from different representation subspaces at different positions. Because the model contains no recurrence and no convolution, we inject positional information using sinusoidal Positional Encodings:
PE(pos, 2i) = sin(pos / 10000^(2i / d_model)), PE(pos, 2i+1) = cos(pos / 10000^(2i / d_model)).

Complexity & Empirical Findings:
Self-attention connects all positions with a constant O(1) number of sequential operations, whereas a recurrent layer requires O(n) sequential operations. However, self-attention incurs O(n^2 * d) computational complexity per layer compared to O(n * d^2) for recurrent layers, making self-attention faster when sequence length n is smaller than representation dimensionality d. On WMT 2014 English-to-German translation, the Big Transformer achieves 28.4 BLEU, improving over the best previously reported models by over 2 BLEU points at a fraction of training cost.`,
  },
  {
    id: "crispr-cas9",
    title: "A Programmable Dual-RNA–Guided DNA Endonuclease in Adaptive Bacterial Immunity",
    authorsAndYear: "Jinek et al. · Science 2012",
    discipline: "Molecular Biology",
    excerpt: `Title: A Programmable Dual-RNA–Guided DNA Endonuclease in Adaptive Bacterial Immunity (CRISPR-Cas9)

Abstract & Core Excerpt:
Clustered regularly interspaced short palindromic repeats (CRISPR)/CRISPR-associated (Cas) systems provide bacteria and archaea with adaptive immunity against invading viruses and plasmids by using CRISPR RNAs (crRNAs) to guide the silencing of invading nucleic acids. In Type II CRISPR-Cas systems, a single protein—Cas9—mediates cleavage of target double-stranded DNA.

We demonstrate that Cas9 endonuclease activity requires two distinct RNA molecules: a mature crRNA containing a 20-nucleotide spacer sequence complementary to the target DNA site, and a trans-activating crRNA (tracrRNA) that base-pairs with the repeat region of crRNA to form an active dual-RNA structure. This dual-RNA complex directs Cas9 to introduce site-specific double-stranded breaks (DSBs) in target DNA.

Cas9 uses two distinct nuclease domains to cleave opposite DNA strands: the HNH nuclease domain cleaves the DNA strand complementary to the 20-nt crRNA guide sequence, whereas the RuvC-like domain cleaves the non-complementary strand, generating blunt-ended double-stranded breaks 3 base pairs upstream of a Protospacer Adjacent Motif (PAM). In Streptococcus pyogenes Cas9, the required PAM sequence is 5'-NGG-3', which enables target discrimination between self CRISPR loci (lacking PAM) and invading foreign DNA.

Crucially, we show that the natural crRNA:tracrRNA duplex can be engineered into a single chimeric guide RNA (sgRNA) by linking the 3' end of crRNA to the 5' end of tracrRNA via a short stem-loop. Reprogramming the 20-nucleotide guide segment at the 5' end of the sgRNA allows Cas9 to be directed to virtually any DNA sequence adjacent to a 5'-NGG-3' PAM, establishing a programmable genome-editing platform. Potential limitations include off-target cleavage when partial mismatches occur outside the 8–12 nt seed region adjacent to the PAM.`,
  },
  {
    id: "raft-consensus",
    title: "In Search of an Understandable Consensus Algorithm (Raft)",
    authorsAndYear: "Ongaro & Ousterhout · USENIX ATC 2014",
    discipline: "Distributed Systems",
    excerpt: `Title: In Search of an Understandable Consensus Algorithm (Raft)

Abstract & Core Excerpt:
Raft is a consensus algorithm for managing a replicated log across a cluster of servers, designed specifically to produce a result equivalent to Multi-Paxos while being significantly easier to understand and implement in practical systems. Consensus algorithms allow a collection of machines to work as a coherent group that can survive the failures of some of its members by ensuring every non-faulty state machine executes the same sequence of commands.

Raft achieves understandability through problem decomposition into three relatively independent subproblems:
1. Leader Election: Time is divided into monotonically increasing terms. Each server is in one of three states: Leader, Follower, or Candidate. If a follower receives no AppendEntries heartbeat within a randomized election timeout (e.g., 150–300 ms), it increments the current term, transitions to Candidate, votes for itself, and issues RequestVote RPCs. Randomized timeouts prevent split votes from repeating indefinitely.
2. Log Replication: The leader accepts client commands, appends them to its local log with the current term, and issues AppendEntries RPCs in parallel to followers. Once a majority (quorum) of servers replicate an entry from the leader's current term, the entry is considered committed and applied to the state machine.
3. Safety: Raft guarantees the Leader Completeness property by adding an election restriction—a candidate cannot win an election unless its log contains all committed entries from previous terms (checked via lastLogTerm and lastLogIndex in RequestVote). Additionally, a leader never commits log entries from previous terms simply by counting replicas; it only commits entries from its own current term, which indirectly commits prior entries via the Log Matching Property.

Limitations & Tradeoffs:
Raft enforces strong leadership: all log entries flow strictly from the leader to followers, simplifying reasoning at the cost of a single leader bottleneck for write throughput. Cluster membership changes must use Joint Consensus or single-server stepping to prevent two disjoint majorities from forming simultaneously during configuration transitions.`,
  },
];
